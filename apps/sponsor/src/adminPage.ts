/** Quiet SEJIRE ops desk — counts and times only. Served by the cashier Worker. */

export function adminPageHtml(opts: { configured: boolean }): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SEJIRE — касса</title>
  <style>
    :root { --ink:#222326; --dim:rgba(34,35,38,.58); --accent:#ff6700; --bg:#f6f5f2; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, sans-serif; background:var(--bg); color:var(--ink); }
    main { max-width: 44rem; margin: 0 auto; padding: 2.2rem 1.2rem 4rem; }
    .mark { font-weight:700; letter-spacing:.12em; font-size:.78rem; }
    .mark i { display:inline-block; width:.55rem; height:.55rem; border-radius:50%; background:var(--accent); margin-right:.4rem; }
    h1 { font-size:1.35rem; font-weight:650; margin:.8rem 0 .35rem; }
    p.sub { color:var(--dim); margin:0 0 1.4rem; line-height:1.45; }
    .cards { display:grid; grid-template-columns: repeat(2, 1fr); gap:.7rem; margin: 1.2rem 0 1.6rem; }
    .card { background:#fff; border-radius:12px; padding:1rem 1.05rem; }
    .card em { display:block; font-style:normal; color:var(--dim); font-size:.72rem; letter-spacing:.04em; text-transform:uppercase; margin-bottom:.35rem; }
    .card strong { font-size:1.45rem; font-weight:650; }
    table { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; }
    th, td { text-align:left; padding:.65rem .85rem; font-size:.88rem; border-bottom:1px solid rgba(34,35,38,.06); }
    th { color:var(--dim); font-weight:550; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; }
    .row { display:flex; gap:.55rem; margin: 1rem 0; }
    input { flex:1; min-height:2.7rem; border:1px solid rgba(34,35,38,.14); border-radius:8px; padding:0 .8rem; font: inherit; }
    button { appearance:none; border:0; background:var(--accent); color:#fff; font:inherit; font-weight:650; min-height:2.7rem; padding:0 1rem; border-radius:8px; cursor:pointer; }
    button.ghost { background:transparent; color:var(--ink); border:1px solid rgba(34,35,38,.16); }
    .flags { color:var(--dim); font-size:.88rem; margin-bottom:1.2rem; }
    .err { color:#b42318; }
    section h2 { font-size:.95rem; margin:1.6rem 0 .55rem; }
    .empty { color:var(--dim); padding: .9rem; }
  </style>
</head>
<body>
  <main>
    <div class="mark"><i></i>SEJIRE</div>
    <h1>Касса</h1>
    <p class="sub">Только числа и время. Имена, 12 слов и содержимое древ сюда не попадают.</p>
    ${
      opts.configured
        ? `<div class="row" id="gate">
        <input id="token" type="password" autocomplete="current-password" placeholder="Ключ админки" />
        <button type="button" id="enter">Войти</button>
      </div>
      <p class="err" id="err" hidden></p>
      <div id="desk" hidden></div>`
        : `<p class="err">Админка ещё не включена. На своём компьютере запустите <code>npm run treasury:init</code> и положите <code>ADMIN_TOKEN</code> в секреты кассира.</p>`
    }
  </main>
  <script>
    const gate = document.getElementById("gate");
    const desk = document.getElementById("desk");
    const err = document.getElementById("err");
    const tokenInput = document.getElementById("token");
    const enter = document.getElementById("enter");
    if (!enter) { /* not configured */ } else {
      const saved = sessionStorage.getItem("sejire_admin") || "";
      if (saved) tokenInput.value = saved;
      enter.addEventListener("click", () => load());
      tokenInput.addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
      if (saved) load();
    }
    function tenge(n) {
      return new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
    }
    function when(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("ru-KZ", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }
    async function load() {
      err.hidden = true;
      const token = tokenInput.value.trim();
      if (token.length < 16) { err.textContent = "Ключ слишком короткий."; err.hidden = false; return; }
      const res = await fetch("/v1/admin/overview", { headers: { Authorization: "Bearer " + token } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        err.textContent = body.error === "unauthorized" ? "Неверный ключ." : (body.error || "Не открылось.");
        err.hidden = false;
        desk.hidden = true;
        return;
      }
      sessionStorage.setItem("sejire_admin", token);
      gate.hidden = true;
      desk.hidden = false;
      const createdRows = (body.created || []).map((r) => "<tr><td>" + when(r.at) + "</td></tr>").join("")
        || "<tr><td class='empty'>Пока ни одного сейфа</td></tr>";
      const payRows = (body.payments || []).map((p) =>
        "<tr><td>" + when(p.at) + "</td><td>" + tenge(p.amountMinor) + "</td><td>" + p.provider + "</td><td>" + (p.status === "saved" ? "сейф в сети" : "оплачено") + "</td></tr>"
      ).join("") || "<tr><td colspan='4' class='empty'>Оплат пока нет</td></tr>";
      desk.innerHTML = \`
        <div class="flags">
          Казна: \${body.treasuryReady ? "ключ на кассире есть" : "ключа ещё нет"}
          · Kaspi: \${body.kaspiReady ? "подключен" : "ещё нет"}
          \${body.treasuryAddress ? " · адрес " + body.treasuryAddress.slice(0,6) + "…" + body.treasuryAddress.slice(-4) : ""}
        </div>
        <div class="cards">
          <div class="card"><em>Деревьев</em><strong>\${body.trees}</strong></div>
          <div class="card"><em>Сохранений</em><strong>\${body.saves}</strong></div>
          <div class="card"><em>Оплат</em><strong>\${body.paidCount}</strong></div>
          <div class="card"><em>Сумма</em><strong>\${tenge(body.paidMinor || 0)}</strong></div>
        </div>
        <section>
          <h2>Когда появились деревья</h2>
          <table><thead><tr><th>Время</th></tr></thead><tbody>\${createdRows}</tbody></table>
        </section>
        <section>
          <h2>Оплаты</h2>
          <table><thead><tr><th>Время</th><th>Сумма</th><th>Путь</th><th>Статус</th></tr></thead><tbody>\${payRows}</tbody></table>
        </section>
        <div class="row"><button class="ghost" type="button" id="out">Выйти</button></div>
      \`;
      document.getElementById("out").onclick = () => {
        sessionStorage.removeItem("sejire_admin");
        location.reload();
      };
    }
  </script>
</body>
</html>`;
}
