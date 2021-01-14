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
    hyst:           null
};

function sendToESP(message, ws) {
    console.log(`Отправляю на ESP: ${message}`);
    if (ESP_client == null) {
        return false;
    }

    ESP_client.ping(function noop() {});

    ESP_client.send(message);
    return true;
}

function sendJSON(ws, object) {
    ws.send(JSON.stringify(object));
}

ws_server.on("connection", function connection(ws) {
    // Обрабатываем клиента

    ws.on("message", function incoming(message) {
        console.log(`${ESP_client == ws ? "ESP" : "Клиент"} отправил: '${message}'`);
        
        // TODO: Починить проблему с отсоединением у ESP
        // Потому что это какая-то дичь
        if (ESP_client == ws && message == "disconnect") {
            ws._events.close[1]();
        }

        // Клиент помечает себя как ESP
        if (message == "ESP") {
            console.log("ESP вышел в сеть");
            ESP_client = ws;
            
            clients.forEach(client => sendJSON(client, {eventName: "ESP_status", data: "connected"}));
        }
        // Клиент помечает себя как обычный клиент
        else if (message == "client") {
            // Добавляем клиента в список клиентов
            clients.push(ws);
            // Оповещаем его о статусе ESP
            sendJSON(ws, {eventName: "ESP_status", data: ESP_client != null ? "connected" : "disconnected"});
        }
        // Обработка сообщений от ESP и клиента
        else {
            // Обработка сообщений от ESP
            if (ws == ESP_client) {
                if (message.startsWith("systemData`")) {
                    // Срезаем заголовок
                    message = message.substr("systemData`".length);

                    // Разбиваем значения, разделенные запятыми, в массив
                    const values = message.split(",");
                    // Проверка на валидность
                    // Если размер не 10 - данные повредились и мы их игнорируем
                    if (values.length != 10) {
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

                    // Отправляем клиентам
                    clients.forEach(client => sendJSON(client, {eventName: "requested_data", ok: true, data: CauldronData}));
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

            clients.forEach(client => sendJSON(client, {eventName: "ESP_status", data: "disconnected"}));
        }
        else {
            console.log("Клиент был отключен");
            clients = clients.filter(x => x != ws);
        }
    });
});

// Запускаем прослушивание на порте
server.listen(3000);