<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Network Study Tools</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#f2f2ef;--surface:#ffffff;--surface-s:#f0f0ec;--text:#1a1a18;--text-s:#68685f;--text-t:#aaa;
  --border:rgba(0,0,0,.09);--border-m:rgba(0,0,0,.16);
  --info-bg:#e5eefc;--info-text:#174da8;--info-bdr:#a8c8f4;
  --ok-bg:#e5f5da;--ok-text:#2a6508;--ok-bdr:#9fd472;
  --r:8px;--rl:12px;--font:'Outfit',system-ui,sans-serif;--mono:'JetBrains Mono','Fira Code',monospace;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#141412;--surface:#1e1e1c;--surface-s:#272725;--text:#f0f0ec;--text-s:#999;--text-t:#555;
  --border:rgba(255,255,255,.09);--border-m:rgba(255,255,255,.16);
  --info-bg:#0a1e40;--info-text:#7aabf0;--info-bdr:#1a4fa5;
  --ok-bg:#0a200a;--ok-text:#7ec050;--ok-bdr:#2a6508;
}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;padding:3rem 1.5rem;line-height:1.6;}
.wrap{max-width:800px;margin:0 auto;}

.site-header{margin-bottom:3rem;}
.site-title{font-size:28px;font-weight:600;letter-spacing:-.01em;margin-bottom:.35rem;}
.site-sub{font-size:15px;color:var(--text-s);max-width:420px;}

.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;}

.game-card{
  display:block;text-decoration:none;color:inherit;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--rl);
  overflow:hidden;transition:transform .18s,box-shadow .18s;
  box-shadow:0 1px 4px rgba(0,0,0,.06);
}
.game-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,.10);}

.card-accent{height:5px;}
.card-accent.blue{background:var(--info-text);}
.card-accent.green{background:var(--ok-text);}

.card-body{padding:1.5rem 1.5rem 1.25rem;}
.card-icon{
  width:44px;height:44px;border-radius:var(--r);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:13px;font-weight:500;
  margin-bottom:1rem;
}
.card-icon.blue{background:var(--info-bg);color:var(--info-text);border:1px solid var(--info-bdr);}
.card-icon.green{background:var(--ok-bg);color:var(--ok-text);border:1px solid var(--ok-bdr);}

.card-title{font-size:18px;font-weight:600;margin-bottom:.4rem;}
.card-desc{font-size:14px;color:var(--text-s);line-height:1.6;margin-bottom:1rem;}

.card-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem;}
.tag{font-size:11px;font-family:var(--mono);background:var(--surface-s);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-s);}

.card-footer{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1.5rem;background:var(--surface-s);border-top:1px solid var(--border);}
.play-label{font-size:14px;font-weight:500;color:var(--text-s);}
.play-arrow{font-size:18px;color:var(--text-t);transition:transform .15s;}
.game-card:hover .play-arrow{transform:translateX(4px);color:var(--text-s);}
</style>
</head>
<body>
<div class="wrap">

  <div class="site-header">
    <div class="site-title">Network Study Tools</div>
    <div class="site-sub">Interactive practice games for networking fundamentals. Pick a topic and start training.</div>
  </div>

  <div class="card-grid">

    <a href="subnet_trainer.html" class="game-card">
      <div class="card-accent blue"></div>
      <div class="card-body">
        <div class="card-icon blue">IP/&#8203;CIDR</div>
        <div class="card-title">Subnet Trainer</div>
        <div class="card-desc">Practice IPv4 subnetting with randomly generated addresses. Work out subnet masks, network addresses, broadcast addresses, usable hosts, and more.</div>
        <div class="card-tags">
          <span class="tag">CIDR</span>
          <span class="tag">IPv4</span>
          <span class="tag">Subnetting</span>
          <span class="tag">Wildcard</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="play-label">Open trainer</span>
        <span class="play-arrow">&#8594;</span>
      </div>
    </a>

    <a href="binary_game.html" class="game-card">
      <div class="card-accent green"></div>
      <div class="card-body">
        <div class="card-icon green">01</div>
        <div class="card-title">Binary Trainer</div>
        <div class="card-desc">Convert between decimal and binary with timed rounds. Includes an interactive bit table you can toggle to work through calculations step by step.</div>
        <div class="card-tags">
          <span class="tag">Binary</span>
          <span class="tag">Decimal</span>
          <span class="tag">Bit weights</span>
          <span class="tag">8-bit</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="play-label">Open trainer</span>
        <span class="play-arrow">&#8594;</span>
      </div>
    </a>

  </div>

</div>
</body>
</html>
