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

        statusLabel.textContent = "Подключено. Ожидание пакетов MAVLink...";
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
        let startIndex = byteBuffer.indexOf(0xFD);
        
        if (startIndex === -1) {
            byteBuffer = new Uint8Array(0);
            break;
        }

        if (startIndex > 0) {
            byteBuffer = byteBuffer.slice(startIndex);
        }

        if (byteBuffer.length < 12) break; 

        let payloadLen = byteBuffer[1];
        let msgId = byteBuffer[7] | (byteBuffer[8] << 8) | (byteBuffer[9] << 16);
        let packetLen = 12 + payloadLen + 2; 

        if (byteBuffer.length < packetLen) break; 

        let packetData = byteBuffer.slice(10, 10 + payloadLen);
        handleMavlinkMessage(msgId, packetData);

        byteBuffer = byteBuffer.slice(packetLen);
    }
}

function handleMavlinkMessage(msgId, payload) {
    let view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // Обработка базового статуса SYS_STATUS (оставляем для гироскопа)
    if (msgId === 1) {
        let health = view.getUint32(8, true); 
        let gyroOk = (health & 0x00000001) && (health & 0x00000002); 

        if (gyroOk) {
            document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#4caf50">ICM42688 (Foxeer) - РАБОТАЕТ</span>';
        } else {
            document.getElementById('gyroLine').innerHTML = '• ГИРОСКОП: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
        }
    }

    // Обработка данных от Lua-скрипта
    if (msgId === 252) {
        let value = view.getInt32(4, true); 
        let nameBytes = payload.slice(8, 18);
        let name = new TextDecoder().decode(nameBytes).replace(/\0/g, '').trim();

        if (name === 'TEST_BAR') {
            if (value === 1) document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#4caf50">DPS310 (Foxeer) - РАБОТАЕТ</span>';
            else document.getElementById('baroLine').innerHTML = '• БАРОМЕТР: <span style="color:#f44336">ОШИБКА ДАТЧИКА</span>';
        }
        if (name === 'TEST_GPS') {
            if (value === 1) document.getElementById('gpsLine').innerHTML = '• Модуль GPS: <span style="color:#4caf50">ОПРЕДЕЛЕН (ОК)</span>';
            else document.getElementById('gpsLine').innerHTML = '• Модуль GPS: <span style="color:#f44336">НЕ ОПРЕДЕЛЕН</span>';
        }
        if (name === 'TEST_OSD') {
            if (value === 1) document.getElementById('osdLine').innerHTML = '• Графический чип OSD: <span style="color:#4caf50">РАБОТАЕТ (ОК)</span>';
            else document.getElementById('osdLine').innerHTML = '• Графический чип OSD: <span style="color:#f44336">ОШИБКА ИНИЦИАЛИЗАЦИИ</span>';
        }
        if (name === 'TEST_MOT') {
            if (value === 1) document.getElementById('motLine').innerHTML = '• Выходы моторов (ESC): <span style="color:#4caf50">ГОТОВЫ (ОК)</span>';
            else document.getElementById('motLine').innerHTML = '• Выходы моторов (ESC): <span style="color:#f44336">ОШИБКА</span>';
        }
        if (name === 'TEST_URT') {
            if (value === 1) document.getElementById('uartLine').innerHTML = '• Шины UART: <span style="color:#4caf50">ТЕСТ ПРОЙДЕН (ОК)</span>';
            else document.getElementById('uartLine').innerHTML = '• Шины UART: <span style="color:#f44336">ОШИБКА ЛИНИИ</span>';
        }
    }
}
