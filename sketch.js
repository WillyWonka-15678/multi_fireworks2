let fireworks = [];
let gravity;
let fireworkSound1;
let fireworkSound2;
let started = false; // 用于iOS音频解锁状态
let socket;

function preload() {
  // 请确保你有一个声音文件在同目录下
  soundFormats('mp3', 'wav');
  fireworkSound1 = loadSound('firevoice1.wav');
  fireworkSound2 = loadSound('firevoice2.wav');
}

function setup() {
  // 连接到当前的服务器
  socket = io();

  // 监听来自其他人的烟花
  socket.on('firework_blast', (data) => {
    // 当收到别人发射的消息时，本地也执行发射函数
    // 注意：这里需要确保 launchFirework 不会再次向外 emit，避免死循环
    receiveRemoteFirework(data.x, data.y, data.hu);
  });

  // 1. 全屏显示
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB);
  gravity = createVector(0, 0.2);
  stroke(255);
  strokeWeight(4);
  background(0);

  // 初始提示文字
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(24);
  text("点击屏幕开始烟花秀", width / 2, height / 2);
}

function windowResized() {
  // 2. 窗口大小自适应（横竖屏切换）
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  if (!started) return; // 未点击前不更新逻辑

  // 黑色背景带拖影效果 (Alpha 控制)
  background(0, 0, 0, 0.2);

  // 倒序遍历，方便删除已消失的烟花
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].show();
    if (fireworks[i].done()) {
      fireworks.splice(i, 1);
    }
  }
}

// 修改后的发射函数：根据点击高度动态计算速度
function launchFirework(x, y) {
  if (!started) {
    started = true;
    userStartAudio();
  }

  let hu = random(360);

  // 计算飞到点击位置所需的初速度 (v = sqrt(2 * g * distance))
  let distance = height - y;
  let gravityMag = 0.2; // 对应 gravity = createVector(0, 0.2)
  let initialVel = -sqrt(2 * gravityMag * distance);

  // 限制一下最小速度，防止点太低处没反应
  initialVel = min(initialVel, -5);

  fireworks.push(new Firework(x, initialVel, hu, y));

  const randomSound = random() > 0.5 ? fireworkSound1 : fireworkSound2;
  if (randomSound.isLoaded()) {
    randomSound.play();
  }

  socket.emit('firework', { x: x, y: y, hu: hu });
}

// 新增：专门处理远程同步的函数（不带 emit）
function receiveRemoteFirework(x, y, hu) {
  if (!started) return; // 如果还没点击过，可能由于浏览器政策无法播放声音
  fireworks.push(new Firework(x, y, hu));

  // 远程烟花的声音
  const randomSound = random() > 0.5 ? fireworkSound1 : fireworkSound2;
  if (randomSound.isLoaded()) { randomSound.play(); }
}

// 交互：鼠标点击
function mousePressed() {
  launchFirework(mouseX, mouseY);
  return false;
}

// 交互：手机触摸 (支持多点触控)
function touchStarted() {
  for (let i = 0; i < touches.length; i++) {
    launchFirework(touches[i].x, touches[i].y);
  }
  return false; // 防止手机端下拉刷新
}

// --- 烟花与粒子类定义 ---

class Firework {
  constructor(x, initialVel, hu, targetY) {
    this.hu = hu;
    // 传递初速度给 Particle
    this.firework = new Particle(x, height, this.hu, true, initialVel);
    this.targetY = targetY;
    this.exploded = false;
    this.particles = [];
  }

  done() {
    return (this.exploded && this.particles.length === 0);
  }

  update() {
    if (!this.exploded) {
      this.firework.applyForce(gravity);
      this.firework.update();
      // 判定逻辑：速度变慢或越过目标位置即爆炸
      if (this.firework.vel.y >= -1 || this.firework.pos.y <= this.targetY) {
        this.exploded = true;
        this.explode();
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(gravity);
      this.particles[i].update();
      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }
  }

  explode() {
    // 手机端性能优化：粒子数从100降到40
    let count = isMobile() ? 40 : 80;
    for (let i = 0; i < count; i++) {
      const p = new Particle(this.firework.pos.x, this.firework.pos.y, this.hu, false);
      this.particles.push(p);
    }
  }

  show() {
    if (!this.exploded) {
      this.firework.show();
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].show();
    }
  }
}

class Particle {
  constructor(x, y, hu, rocket, initialVel) {
    this.pos = createVector(x, y);
    this.rocket = rocket;
    this.lifespan = 255;
    this.hu = hu;
    if (this.rocket) {
      this.vel = createVector(0, initialVel); // 使用计算出的动态速度
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(2, 8)); // 爆炸范围稍微调小一点，增加紧凑感
    }
    this.acc = createVector(0, 0);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.rocket) {
      this.vel.mult(0.92); // 阻力稍大一点，减少长尾巴计算
      this.lifespan -= 5;   // 消失速度加快，腾出内存
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  done() {
    return (this.lifespan < 0);
  }

  show() {
    colorMode(HSB);
    if (!this.rocket) {
      strokeWeight(2);
      stroke(this.hu, 255, 255, this.lifespan);
    } else {
      strokeWeight(3);
      stroke(this.hu, 255, 255);
    }
    point(this.pos.x, this.pos.y);
  }
}

// 辅助函数：判断是否为手机
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}