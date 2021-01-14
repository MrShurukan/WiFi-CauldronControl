let socket = null;
connect();

function connect() {
    socket = new WebSocket(`ws://${location.host}`);

    socket.onopen = (event) => {
        console.log("Успешное подключение к серверу!");
        receiveMessage("server_connect");
        sendData("client");
    };
    socket.onmessage = (event) => {
        //console.log(event);
        console.log(event.data);
        console.log(JSON.parse(event.data));
        const obj = JSON.parse(event.data);

        receiveMessage(obj.eventName, obj);
    }
    socket.onclose = (event) => {
        console.log("Соединение с сервером разорвано, пробую переподключиться");
        receiveMessage("server_disconnect");
        connect();
    }
}

function disconnect() {
    socket.close();
    socket = null;
}

function sendData(data) {
    socket.send(data);
}