let fireworks = [];
let gravity;
let fireworkSound1;
let fireworkSound2;
let started = false; // 用于iOS音频解锁状态

function preload() {
  // 请确保你有一个声音文件在同目录下
  soundFormats('mp3', 'wav');
  fireworkSound1 = loadSound('firevoice1.wav');
  fireworkSound2 = loadSound('firevoice2.wav');
}

function setup() {
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

// 核心发射函数：处理震动、声音、视觉和通信
function launchFirework(x, y) {
  if (!started) {
    started = true;
    userStartAudio(); // 解锁浏览器音频上下文
  }

  // 3. 震动反馈 (Android 兼容)
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }

  // 4. 随机播放两个声音之一
  const randomSound = random() > 0.5 ? fireworkSound1 : fireworkSound2;
  if (randomSound.isLoaded()) {
    randomSound.play();
  }

  // 生成随机颜色的烟花
  let hu = random(360);
  fireworks.push(new Firework(x, y, hu));

  // 5. 联网同步 (此处对接你的 Socket 服务器)
  if (typeof socket !== 'undefined') {
    socket.emit('firework', { x: x, y: y, hu: hu });
  }
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
  constructor(x, y, hu) {
    this.hu = hu;
    this.firework = new Particle(x, height, this.hu, true); // 从底部升起
    this.targetY = y; // 目标高度
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
      // 到达点击位置或向上速度消失时爆炸
      if (this.firework.vel.y >= 0 || this.firework.pos.y <= this.targetY) {
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
    for (let i = 0; i < 100; i++) {
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
  constructor(x, y, hu, rocket) {
    this.pos = createVector(x, y);
    this.rocket = rocket;
    this.lifespan = 255;
    this.hu = hu;
    this.delayCounter = rocket ? 0 : 60; // 非火箭粒子延迟60帧后开始消失
    if (this.rocket) {
      this.vel = createVector(0, random(-12, -15));
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(2, 10));
    }
    this.acc = createVector(0, 0);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.rocket) {
      this.vel.mult(0.9); // 增加空气阻力
      // 延迟计数器大于0时不减少寿命，否则开始淡出
      if (this.delayCounter > 0) {
        this.delayCounter--;
      } else {
        this.lifespan -= 4;
      }
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  done() {
    return (this.lifespan < 0);
  }

  show() {
    if (!this.rocket) {
      strokeWeight(2);
      stroke(this.hu, 255, 255, this.lifespan);
    } else {
      strokeWeight(4);
      stroke(this.hu, 255, 255);
    }
    point(this.pos.x, this.pos.y);
  }
}