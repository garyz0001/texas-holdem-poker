# 好友德州扑克俱乐部 (Texas Hold'em Online)

一个专为好友联机与 AI 陪练打造的网页端德州扑克全栈应用，原生支持 **本地/局域网直连** 与 **Cloudflare Workers + Durable Objects (免费版 SQLite 后端)** 一键部署。

## ✨ 核心功能

1. **双模式赛制**：
   - **💵 常规桌 (Cash Game)**：盲注恒定，支持自定义最小/最大带入、随时入座/离座、筹码补充 (Rebuy/Top-up)。
   - **🏆 单桌锦标赛 (SNG)**：所有人相同初始记分牌，内置 **闪电赛 (Turbo)**、**标准赛 (Standard)**、**深筹赛 (Deepstack)** 盲注表，支持 **按每 N 手牌** 或 **按每 N 分钟** 自动涨盲与前注 (Ante)，自动判定淘汰名次与总冠军。
2. **5 种性格人设 × 3 档算力 AI 人机陪打**：
   - 🦈 **紧凶型 (TAG)**：严选起手牌，重视位置与底池赔率，翻后基于蒙特卡洛胜率模拟进行价值下注与持续下注 (C-Bet)。
   - 🐆 **松凶型 (LAG)**：范围宽广，高频 3-Bet 与利用同花/顺子听牌半诈唬 (Semi-Bluff) 施压。
   - 🐳 **跟注站 (Calling Station)**：极难被诈唬走，只要有一点对子或听牌就会一路跟注到底。
   - 🃏 **疯鱼型 (Maniac)**：频繁超池加注与全下梭哈，搞乱牌桌节奏、制造巨额底池。
   - 🪨 **岩石型 (Nit)**：极度保守，只玩顶级强牌 (JJ+/AK/AQ)，不中大牌绝不恋战。
   - 支持 **一键补满空位人机**，一个人或两三个朋友也能随时凑齐满桌热闹开局。
3. **丰富牌桌体验**：
   - **📊 实时战绩账单 (Ledger & HUD)**：实时记录每位玩家的总带入、当前筹码、净胜负 (`+ / -`)、手数、胜场、VPIP% (主动入池率) 与 PFR% (翻前加注率)，支持一键复制文字结算单发到微信/群聊。
   - **👀 弃牌/摊牌主动亮牌 (Show Cards)**：支持单亮左牌、单亮右牌或亮出双手底牌。
   - **🐰 发发看 (Rabbit Hunt)**：当牌局在河牌前提前结束时，可点击查看原本会发出的剩余公共牌。
   - **🔊 Web Audio 合成音效、四色牌面切换、BB 倍数显示切换、延时卡 (+20s) 与快捷表情互动**。

---

## 🚀 本地运行与局域网联机

```bash
# 1. 进入项目目录
cd C:\Users\LEGION\.gemini\antigravity\scratch\texas-holdem-poker

# 2. 启动本地开发与联机服务器
npm run dev
```

启动后浏览器访问 `http://localhost:5173`（同一局域网下的朋友可直接访问终端显示的 Network 地址，如 `http://192.168.x.x:5173/?room=VIP888`）。

---

## ☁️ 部署到 Cloudflare (完全适配免费账户 Free Plan)

本项目已配置好 `wrangler.toml`，采用 Cloudflare 向免费版开放的 **SQLite-backed Durable Objects (`new_sqlite_classes`)** + **Workers Static Assets**，无需绑定付费 KV，**$0 免费额度即可部署**：

```bash
# 1. 登录您的 Cloudflare 账号（首次部署会弹出浏览器授权）
npx wrangler login

# 2. 编译前端并一键部署到 Cloudflare Workers
npm run cf:deploy
```

部署完成后，终端会输出您的专属线上域名（如 `https://texas-holdem-poker.<您的子域名>.workers.dev`），直接发给朋友即可随时随地跨网联机！
