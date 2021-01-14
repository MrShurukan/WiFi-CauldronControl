// Подключение необходимых библиотек и настройка
const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const uuid = require('uuid');

const { performance } = require('perf_hooks');

const http = require("http");
// const path = require("path");

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.use(express.static("public"));

const server = http.createServer(app);


// Создание экземпляра для WebSockets
const WebSocket = require("ws");
const ws_server = new WebSocket.Server({server});

// Прописывание логики для WebSockets
let ESP_client = null;
let ESP_status = "disconnected";
let clients = [];

const CauldronData = {
    temperatures: {
        POD:    null,
        SETPOD: null, 
        OBR:    null,
        TPOL:   null,
        UL:     null,
        DOM:    null,
        SETDOM: null
    },
    chosenCauldron: null,
    chosenMode:     null,
    hyst:           null,
    activeHeat:     null,
    cSystemState:   null
};

// ID таймера, который отслеживает, если ESP отключилась
let timeoutID = null;
function sendToESP(message, ws) {
    console.log(`Отправляю на ESP: ${message}`);
    if (ESP_client == null) {
        return false;
    }

    //ESP_client.ping(function noop() {});
    if (timeoutID == null) {
        timeoutID = setTimeout(() => {
            console.log("Timeout!");
            if (ESP_client) disconnectESP(ESP_client);
        }, 5000);
    }

    ESP_client.send(message);
    return true;
}

function sendJSON(ws, object) {
    ws.send(JSON.stringify(object));
}

function sendEspStatusToAllClients() {
    clients.forEach(client => sendJSON(client, {eventName: "ESP_status", data: ESP_status}));
}

function disconnectESP(ws) {
    ws._events.close[1]();
}

ws_server.on("connection", function connection(ws) {
    // Обрабатываем клиента

    ws.on("message", function incoming(message) {
        console.log(`${ESP_client == ws ? "ESP" : "Клиент"} отправил: '${message}'`);
        
        // TODO: Починить проблему с отсоединением у ESP
        // Потому что это какая-то дичь
        if (ESP_client == ws && message == "disconnect") {
            disconnectESP(ws);
        }

        // Клиент помечает себя как ESP
        if (message == "ESP") {
            console.log("ESP вышел в сеть");
            ESP_client = ws;
            ESP_status = "connected";
            
            sendEspStatusToAllClients();
        }
        // Клиент помечает себя как обычный клиент
        else if (message == "client") {
            // Добавляем клиента в список клиентов
            clients.push(ws);
            // Оповещаем его о статусе ESP
            sendJSON(ws, {eventName: "ESP_status", data: ESP_status});
        }
        // Обработка сообщений от ESP и клиента
        else {
            // Обработка сообщений от ESP
            if (ws == ESP_client) {
                // Очищаем timeout по которому устройство считается отключенным
                clearTimeout(timeoutID);
                timeoutID = null;

                // Системные данные
                if (message.startsWith("`")) {
                    if (ESP_status == "mainDeviceDoesntRespond") {
                        ESP_status = "connected";
                        sendEspStatusToAllClients();
                    }
                    ESP_status = "connected";

                    // Срезаем заголовок
                    // (до этого заголовок был другим, оставляем для возможного редактирования)
                    message = message.substr("`".length); 

                    // Разбиваем значения, разделенные запятыми, в массив
                    const values = message.split(",");
                    // Проверка на валидность
                    // Если размер не 10 - данные повредились и мы их игнорируем
                    if (values.length != 12) {
                        // Запрашиваем отправку ещё раз
                        ESP_client.send("requestData");
                        return;
                    }

                    // Заносим значения в кеш-объект
                    CauldronData.temperatures.POD    = values[0];
                    CauldronData.temperatures.SETPOD = values[1];
                    CauldronData.temperatures.OBR    = values[2];
                    CauldronData.temperatures.TPOL   = values[3];
                    CauldronData.temperatures.UL     = values[4];
                    CauldronData.temperatures.DOM    = values[5];
                    CauldronData.temperatures.SETDOM = values[6];

                    CauldronData.chosenCauldron      = values[7];
                    CauldronData.chosenMode          = values[8];
                    CauldronData.hyst                = values[9];
                    CauldronData.activeHeat          = values[10];
                    CauldronData.cSystemState        = values[11];

                    // Отправляем клиентам
                    clients.forEach(client => sendJSON(client, {eventName: "requested_data", ok: true, data: CauldronData}));
                }
                else if (message == "mainDeviceDoesntRespond") {
                    ESP_status = "mainDeviceDoesntRespond";
                    sendEspStatusToAllClients();
                }
            }
            // Обработка сообщений от клиента
            else {
                if (message == "requestData") {
                    // Отправляем данные
                    if (sendToESP("requestData")) {
                        sendJSON(ws, {eventName: "requested_data", ok: true, data: CauldronData});
                    }
                    else {
                        // sendJSON(ws, {ok: false, eventName: "requested_data", data: "ESP_is_disconnected"});
                        sendJSON(ws, {eventName: "ESP_status", data: "disconnected"});
                    }
                }
                else if (message == "resetBoard") {
                    sendToESP(message);
                }
                // Ручное управление ESP
                else if (message.startsWith("send")) {
                    ESP_client.send(message);
                }
            }
        }
    });

    ws.on("close", function close() {
        if (ESP_client == ws) {
            console.log("ESP отключен!");
            ESP_client = null;
            ESP_status = "disconnected";

            sendEspStatusToAllClients();
        }
        else {
            console.log("Клиент был отключен");
            clients = clients.filter(x => x != ws);
        }
    });
});

// Запускаем прослушивание на порте
server.listen(3000);