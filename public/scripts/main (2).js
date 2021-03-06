let deviceImage, 
    resetImages = {regular: null, shadowed: null}, 
    upperBtnImages = {regular: null, shadowed: null},
    lowerBtnImages = {regular: null, shadowed: null},
    checkIcon;

let scalingFactor, translateX, translateY;

// Требуется для функции drawButtons
let buttons = [];

// ПРОСТАВЛЕНО ВРУЧНУЮ ОПЫТНЫМ ПУТЁМ
// Первое значение - верхний левый угол
// Второе значение - нижний правый угол
// Тут указаны относительные координаты хитбоксов всех кнопок 
// Это относительные координаты, см. функцию getRelativeCoordinates
const resetButtonBounds = [
    {x: 0.1123384396870605, y: 0.4177274625958836},
    {x: 0.11978680654395608, y: 0.44005601124022176}
];
const upperButtonBounds = [
    {x: 0.7164837514130363, y: 0.23484601655654286},
    {x: 0.7702775120461711, y: 0.2986418698260804}
];
const lowerButtonBounds = [
    {x: 0.7173113477304691, y: 0.5049151287309183},
    {x: 0.7711051083636039, y: 0.5676477177792967}
];
const displayBounds = [
    {x: 0.14385079455157875, y: 0.21870726057568163},
    {x: 0.635380988693852, y: 0.6303803068276752}
];

function preload() {
    deviceImage = loadImage("images/CC_Device_no_buttons.png");

    resetImages.regular = loadImage("images/CC_Device_reset_button_fullsize.png");
    upperBtnImages.regular = loadImage("images/CC_Device_upper_button_fullsize.png");
    lowerBtnImages.regular = loadImage("images/CC_Device_lower_button_fullsize.png");

    resetImages.shadowed = loadImage("images/CC_Device_reset_button_fullsize_shadow.png");
    upperBtnImages.shadowed = loadImage("images/CC_Device_upper_button_fullsize_shadow.png");
    lowerBtnImages.shadowed = loadImage("images/CC_Device_lower_button_fullsize_shadow.png");
    
    checkIcon = loadImage("images/checkIcon.png");
}

// Кэш-объект со значениями котла
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

// Состояние ESP
let espStatus = "disconnected";
// Подключение к основному серверу
let connectedToServer = false;

function assignCauldronData(newData) {
    const oldT = CauldronData.temperatures;
    const newT = newData.temperatures;

    oldT.POD = newT.POD;
    oldT.SETPOD = newT.SETPOD;
    oldT.OBR = newT.OBR;
    oldT.TPOL = newT.TPOL;
    oldT.UL = newT.UL;
    oldT.DOM = newT.DOM;
    oldT.SETDOM = newT.SETDOM;

    CauldronData.chosenCauldron = newData.chosenCauldron;
    CauldronData.chosenMode = newData.chosenMode;
    CauldronData.hyst = newData.hyst;
}

// ID интервала, который будет опрашивать сервер о новых данных
let request_interval_id = null; 

// Вызывается из websockets.js, когда приходит сообщение
function receiveMessage(eventName, message) {
    switch(eventName) {
        case "server_connect":
            connectedToServer = true;
            break;

        case "server_disconnect":
            connectedToServer = false;
            break;

        case "requested_data":
            if (message.ok)
                assignCauldronData(message.data);
            else {
                console.log(`Ошибка на сервере: ${message.data}`);
                /*if (message.data == "ESP_is_disconnected") {
                    
                }*/
            }
            break;
        
        case "ESP_status":
            switch (message.data) {
                case "connected":
                    espStatus = message.data;
                    
                    sendData("requestData");
                    request_interval_id = setInterval(() => sendData("requestData"), 5000);
                    break;
                case "disconnected":
                    espStatus = message.data;

                    clearInterval(request_interval_id);
                    request_interval_id = null;
                    break;
                default:
                    console.log(`Неизвестное состояние ESP: ${message.data}`);
                    break;
            }
            break;

        default:
            console.log(`Неизвестный event: ${eventName};`);
            console.log(message);
    }
}

function setup() {
    console.log("Welcome to CC Online");
    createCanvas(windowWidth, windowHeight);

    calculateImageValues();
    addButton(resetImages, resetButtonBounds);
    addButton(upperBtnImages, upperButtonBounds);
    addButton(lowerBtnImages, lowerButtonBounds);
}

function draw() {
    background(170);

    push();
    scale(scalingFactor);
    translate(translateX, translateY);

    image(deviceImage, 0, 0);
    cursor(ARROW);
    drawButtons();

    pop();
    drawDisplay();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    calculateImageValues();
}

function mousePressed() {
    const rMousePos = getRelativeCoordinates(mouseX, mouseY);
    // console.log(rMousePos);
    // console.log(mouseX, mouseY);
    // console.log(getScreenCoordinates(rMousePos.x, rMousePos.y));

    
    if (isInRect(rMousePos, resetButtonBounds)) {
        // console.log("In reset!");
        Swal.fire({
            title: 'Вы уверены?',
            text: "Это произведёт удалённый софт-ресет платы",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Да, производим ресет!',
            cancelButtonText: 'Нет, не стоит'
        }).then((result) => {
            if (result.isConfirmed) {
                sendData("resetBoard");
                Swal.fire(
                    'В процессе!',
                    'Плата ушла на перезапуск.',
                    'success'
                );
            }
        });
    }
    if (isInRect(rMousePos, upperButtonBounds)) {
        console.log("In upper!");
    }
    if (isInRect(rMousePos, lowerButtonBounds)) {
        console.log("In lower!");
    }

    if (isInRect(rMousePos, displayBounds)) {
        console.log("In screen!");
    }
}


function addButton(images, bounds) {
    buttons.push({images, bounds});
}

function drawButtons() {
    const rMousePos = getRelativeCoordinates(mouseX, mouseY);

    for (button of buttons) {
        if (isInRect(rMousePos, button.bounds)) {
            cursor(HAND);
            if (mouseIsPressed) {
                image(button.images.regular, 0, 0);
            }
            else {
                image(button.images.shadowed, 0, 0)
            }
        }
        else {
            image(button.images.shadowed, 0, 0);
        }
    }
}

// Выводит сообщение на центр экрана
// dPos - координаты экранчика устройства
function displayTextCenter(string, size, col) {
    const db0 = displayBounds[0], db1 = displayBounds[1];
    const dPos = [getScreenCoordinates(db0.x, db0.y), getScreenCoordinates(db1.x, db1.y)];
    // Считаем количество строчек в тексте
    // const lineAmount = (string.match(/\n/g) || []).length;

    rectMode(CENTER);
    textAlign(CENTER, CENTER);
    textSize(scaleF(size));
    fill(col);
    text(string, (dPos[0].x + dPos[1].x) / 2, (dPos[0].y + dPos[1].y) / 2, 600, 400); // string.length * textSize(), textSize() * lineAmount * 2);
}

function displayTextLeft(string, size, col) {
    const db0 = displayBounds[0], db1 = displayBounds[1];
    const dPos = [getScreenCoordinates(db0.x, db0.y), getScreenCoordinates(db1.x, db1.y)];
    // Считаем количество строчек в тексте
    // const lineAmount = (string.match(/\n/g) || []).length;

    rectMode(CENTER);
    textAlign(CENTER, CENTER);
    textSize(scaleF(size));
    fill(col);
    text(string, (dPos[0].x + dPos[1].x) / 2, (dPos[0].y + dPos[1].y) / 2, 600, 400); // string.length * textSize(), textSize() * lineAmount * 2);
}

// Рисует основной интерфейс программы
let dotsAtTheEnd = ".";
function drawMainLayout() {
    // Если поля выставлены в null, то нужно написать, что идёт загрузка
    if (CauldronData.chosenCauldron == null) {
        // Анимируем точки в конце
        if (frameCount % 40 == 0) dotsAtTheEnd += ".";
        if (dotsAtTheEnd.length == 4) dotsAtTheEnd = ".";
        displayTextCenter("Загрузка данных" + dotsAtTheEnd, 60, color(120, 250, 50));
    }
    else {
        let str = "";
        const t = CauldronData.temperatures;

        str += `Подача = ${t.POD} из ${t.SETPOD}(~${CauldronData.hyst})\n`;
        str += `Обратка = ${t.OBR}\n`;
        str += `Теплый пол = ${t.TPOL}\n`;
        str += '\n';
        str += '\n';
        str += `Улица\t\t\t = \t\t${t.UL}\n`;
        str += `Дом\t\t\t = \t\t${t.DOM}\n`;

        displayTextCenter(str, 60, color(0, 0, 0));
    }
}

function drawDisplay() {
    fill(100, 150, 200);
    rectMode(CORNERS);
    
    const db0 = displayBounds[0], db1 = displayBounds[1];
    const dPos = [getScreenCoordinates(db0.x, db0.y), getScreenCoordinates(db1.x, db1.y)];
    // console.log(displayPos);
    rect(dPos[0].x, dPos[0].y, dPos[1].x, dPos[1].y);
    
    // Нет подключения к серверу
    if (!connectedToServer) {
        displayTextCenter("Отсутствует подключение к главному серверу :(", 50, color(250, 0, 0));
    }
    else {
        if (espStatus == "disconnected") {
            displayTextCenter("ESP устройство сейчас офлайн", 70, color(250, 250, 0));
        }
        else if (espStatus == "connected") {
            // Рисуем галочку в левом нижнем углу устройства
            // Эти офсеты подобраны на глаз, точность тут не важна
            const checkSize = scaleF(85); 
            image(checkIcon, dPos[0].x + scaleF(15), dPos[1].y - scaleF(100), checkSize, checkSize);

            drawMainLayout();
        }
        /*else if (espStatus == "bugged") {

        }*/
    }

    const rMousePos = getRelativeCoordinates(mouseX, mouseY);
    if (isInRect(rMousePos, displayBounds)) {
        cursor(HAND);
    }
}

// Эта функция возвращает значение, умноженное на scalingFactor
function scaleF(val) {
    return val * scalingFactor;
} 

function calculateImageValues() {
    // Высчитываем scaling factor, чтобы изображение помещалось на экране
    const padding = windowHeight * 0.01;
    scalingFactor = (windowHeight - padding) / deviceImage.height;
    // console.log("Scaling factor", scalingFactor);

    // Количество пикселей, на которое требуется сместить изображение горизонтально и вертикально, чтобы оно было по центру
    translateX = (windowWidth - (deviceImage.width * scalingFactor)) / 2;
    translateX *= 1 / scalingFactor; // Я не знаю, почему так нужно делать, но так работает...
    translateY = padding / 2;
    // console.log("Translate:", translateX, translateY);
}

// Конвертирует координаты в пикселях в нормализованные координаты изображения (от 0 до 1)
function getRelativeCoordinates(x, y) {
    const inversedFactor = 1 / scalingFactor; 
    x = (x * inversedFactor - translateX) / deviceImage.width;
    y = (y * inversedFactor - translateY) / deviceImage.height;

    return {x, y};
}

// Конвертирует нормализованные коодинаты в координаты в пикселях
// По факту, это просто обратные операции верхней функции
function getScreenCoordinates(x, y) {
    x = ((x * deviceImage.width ) + translateX) * scalingFactor;
    y = ((y * deviceImage.height) + translateY) * scalingFactor;

    return {x: Math.round(x), y: Math.round(y)};
}

// Проверяет, если данные координаты находятся внутри прямоугольника
function isInRect(coords, rect) {
    return (coords.x >= rect[0].x && coords.x <= rect[1].x) &&
           (coords.y >= rect[0].y && coords.y <= rect[1].y);
}