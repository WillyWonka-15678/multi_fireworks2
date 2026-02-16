const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

app.use(express.static(__dirname)); // 托管当前目录下的 p5.js 文件

io.on('connection', (socket) => {
  console.log('一位用户连接了');

  // 监听某人发射烟花
  socket.on('firework', (data) => {
    // 将该烟花数据广播给除了发送者之外的所有人
    socket.broadcast.emit('firework_blast', data);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});