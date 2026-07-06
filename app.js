let port;
let reader;
const connectBtn = document.getElementById('connectBtn');
const statusLabel = document.getElementById('statusLabel');

let byteBuffer = new Uint8Array(0);

connectBtn.addEventListener('click', async () => {
    if (port) {
        location.reload();
        return;
    }

    if (!('serial' in navigator)) {
        alert('Web Serial API не поддерживается. Используйте Chrome или Edge!');
        return;
    }

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });

        statusLabel.textContent = "Подключено. Получение системных данных...";
        statusLabel.className = "status-text connected";
        connectBtn.textContent = "🔴 ОТКЛЮЧИТЬ";

        readLoop();
    } catch (err) {
        alert("Ошибка подключения: " + err.message);
    }
});

async function readLoop() {
    while (port.readable) {
        reader = port.readable.getReader();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                let newBuffer = new Uint8Array(byteBuffer.length + value.length);
                newBuffer.set(byteBuffer);
                newBuffer.set(value, byteBuffer.length);
                byteBuffer = newBuffer;

                parseBuffer();
            }
        } catch (err) {
            console.error(err);
        } finally {
            reader.releaseLock();
        }
    }
}

function parseBuffer() {
    while (byteBuffer.length > 0) {
        let startIndex = byteBuffer.findIndex(b => b === 0xFD || b === 0xFE);
        
        if (startIndex === -1) {
            byteBuffer = new Uint8Array(0);
            break;
        }

        if (startIndex > 0) {
            byteBuffer = byteBuffer.slice(startIndex);
        }

        if (byteBuffer.length < 8) break; 

        let isV2 = (byteBuffer[0] === 0xFD);
        let payloadLen = byteBuffer[1];
        let headerLen = isV2 ? 12 : 6;
        let msgId = isV2 ? (byteBuffer[7] | (byteBuffer[8] << 8) | (byteBuffer[9] << 16)) : byteBuffer[5];
        let packetLen = headerLen + payloadLen + 2; 

        if (byteBuffer.length < packetLen) break; 

        let packetData = byteBuffer.slice(headerLen, headerLen + payloadLen);
        handleMavlinkMessage(msgId, packetData);

        byteBuffer = byteBuffer.slice(packetLen);
    }
}

function handleMavlinkMessage(msgId, payload) {
    if (payload.length < 12) return;
    let view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // 1. SYS_STATUS (ID: 1) — Статус здоровья датчиков на борту
    if (msgId === 1) {
        let health = view.getUint32(8, true); 

        let gyroPresent = (health & 0x00000001); 
        let accelPresent = (health & 0x00000002); 
        let baroPresent = (health & 0x00000008); 

        if (health > 0) {
            if (gyroPresent || accelPresent) {
                document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#4caf50">ОК (ICM42688)</span>';
            } else {
                document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
            }

            if (baroPresent) {
                document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#4caf50">ОК (DPS310)</span>';
            } else {
                document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
            }
        } else {
            // Если маска пустая, но пакеты идут — плата жива
            document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#4caf50">ДАННЫЕ ИДУТ (ОК)</span>';
            document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#4caf50">ДАННЫЕ ИДУТ (ОК)</span>';
        }
    }

    // 2. GPS_RAW_INT (ID: 24) — Статус спутников GPS
    if (msgId === 24) {
        let fixType = view.getUint8(28); 
        let satellitesVisible = view.getUint8(29); 

        if (fixType > 0) {
            document.getElementById('gpsLine').innerHTML = `• Модуль GPS: <span style="color:#4caf50">ПОДКЛЮЧЕН (Спутников: ${satellitesVisible})</span>`;
        } else {
            document.getElementById('gpsLine').innerHTML = '• Модуль GPS: <span style="color:#ff9800">ПОДКЛЮЧЕН (Поиск спутников...)</span>';
        }
    }
}
