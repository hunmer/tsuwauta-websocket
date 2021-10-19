var express = require('express');
var http = require('http');
var WebSocket = require('ws');

var app = express();
app.use(express.static(__dirname));

var server = http.createServer(app);
var wss = new WebSocket.Server({ server });

function sendTo(type, msg) {
    //console.log('send', type, msg);
    for(var client of getClients(type)){
            client.send(msg);
    }
}
function getClients(type) {
    var clients = [];
    wss.clients.forEach(function each(client) {
        if (type == '' || client.clientType == type) {
            clients.push(client);
        }
    });
    return clients;
}

var g_data = {};
var g_history = {};
var g_playing;
wss.on('connection', function connection(ws) {
    // console.log(ws);
    ws.on('message', function incoming(msg) {
        //把消息发送到所有的客户端
        onmessage(msg, ws);

    });
});

function onmessage(msg, ws){
    let data = JSON.parse(msg);
        console.log(data);
        switch (data.type) {
            case 'setPos':
                sendTo('server', msg)
                break;
            case 'spleeter':
                var key = data.data['source']+'_'+data.data['id'];
                if(g_data[key] && g_data[key].spleeter){
                    return ws.send(JSON.stringify({type: 'alert', data: 'しばらくお待ちください。', class: 'alert-secondary'}))
                }
                setTimeout(() => {
                    if(g_data[key] && g_data[key].spleeter){
                        delete g_data[key].spleeter;
                    }
                }, 1000 * 30);
                g_data[key].spleeter = data.play;
                sendTo('server', msg)
                ws.send(JSON.stringify({type: 'alert', data: '作成中...', class: 'alert-success'}))
                break;
            case 'spleeter_done':
                var key = data.data;
                if(g_data[key] && g_data[key].spleeter){
                    delete g_data[key].spleeter;
                }
                sendTo('client', msg)
                break;
            case 'setStatus': // 设置播放状态
            case 'progress': // 设置播放进度
                if(ws.clientType == 'server') sendTo('client', msg);
                break;
            case 'login': // 设备登录
                ws.clientType = data.clientType;
                sendTo('client', msg);
                
                break;
            case 'nextQuery': // 下一首曲子
                var keys = Object.keys(g_data);
                if(keys.length > 0){
                    //delete g_data[keys[0]]; // 删除第一首
                    onmessage(JSON.stringify({type: 'deleteFromQuery', data: g_data[keys[0]]}));
                }
                if(keys.length > 1){
                    // 播放第二首
                    sendTo('server', JSON.stringify({type: 'playQuery', data: g_data[keys[1]]}));
                }
                break;
            case 'playQuery':
                if(data.index){ // 用主键获取数据
                    if(!g_history[data.index]){
                        console.log('没有数据')
                        return;
                    }
                    data.data = g_history[data.index] ;
                    msg = JSON.stringify(data);
                }
                g_playing = data.data;
                if(ws.clientType == 'client'){
                    if(getClients('server').length == 0){
                        return ws.send(JSON.stringify({type: 'alert', data: 'サーバー見つけていない', class: 'alert-danger'}))
                    }
                }
                sendTo(ws.clientType == 'server' ? 'client' : 'server', msg);
                break;
            case 'getQuery': // 获取播放列表
                ws.send(JSON.stringify({type: 'getQuery', data: g_data}))
                if(ws.clientType == 'client' && g_playing){
                    ws.send(JSON.stringify({type: 'playQuery', data: g_playing}));
                }
                break;
            case 'addToQuery': // 添加到播放列表
                var json = data.data;
                var key = json['source']+'_'+json['id'];
                if(g_data[key]){
                    return ws.send(JSON.stringify({type: 'alert', data: 'すでに追加された'}))
                }
                data.key = key;
                g_data[key] = json;
                g_history[key] = json;
                sendTo('', JSON.stringify(data));
                break;
            case 'deleteFromQuery': // 删除曲子
                var json = data.data;
                var key = json['source']+'_'+json['id'];
                if(g_data[key]){
                    delete g_data[key];
                }
                data.key = key;
                sendTo('', JSON.stringify(data));
                break;
        }
}


server.listen(8000, function listening() {
    console.log('port: 8000');
});