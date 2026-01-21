// js/main.js
// メイン画面（index.html）側：表示専用。localStorage の内容を購読して反映する。
class MainDisplay {
  constructor() {
    this.timer = new TournamentTimer(); // 表示用。start/stop はしない
    this._bindElements();
    this._wireEvents();
    this._renderAll(); // 初期描画
    // 1秒ごとに描画（残り時間の表示更新）
    setInterval(() => this._renderTimerOnly(), 1000);
    // 5秒ごとに全体再読込（保険）
    setInterval(() => { this.timer.loadData(); this._renderAll(); }, 5000);
    // Firestore の状態を購読して反映
if (window.RemoteStore) {
  window.RemoteStore.subscribe((remote) => {
    if (remote.tournamentData) {
      localStorage.setItem('tournamentData', JSON.stringify(remote.tournamentData));
    }
    if (remote.timerState) {
      localStorage.setItem('tournamentTimer', JSON.stringify(remote.timerState));
    }
    this.timer.loadData();
    this._renderAll();
  });
}


  }

  _bindElements() {
    // 基本（index.html の ID に合わせて取得）
    this.tournamentNameEl = document.getElementById('tournament-name');
    this.timerTextEl = document.getElementById('current-time');
    this.currentLevelEl = document.getElementById('current-level');
    this.currentSbEl = document.getElementById('current-sb');
    this.currentBbEl = document.getElementById('current-bb');
    this.currentAnteEl = document.getElementById('current-ante');
    this.currentLevelInfoWrap = document.querySelector('.current-level-info');

    this.nextSbEl = document.getElementById('next-sb');
    this.nextBbEl = document.getElementById('next-bb');
    this.nextAnteEl = document.getElementById('next-ante');
    this.nextBreakEl = document.getElementById('next-break');

    // 画面にあるなら使う（無くてもOK）
    this.breakIndicatorEl = document.getElementById('break-indicator');

    this.nextBlindsWrap = document.querySelector('.next-blinds-text');

    this.rewardListEl = document.getElementById('reward-list');
    this.averageStackEl = document.getElementById('average-stack-value');
    this.currentPlayersEl = document.getElementById('current-players');
    this.totalEntriesEl = document.getElementById('total-entries');
  }

  _wireEvents() {
    // 別タブ（管理画面）から storage が更新されたら即反映
    window.addEventListener('storage', (e) => {
      if (e.key === 'tournamentTimer' || e.key === 'tournamentData') {
        this.timer.loadData();
        this._renderAll();
      }
    });

    // レベル変更・残り時間のコールバック（描画更新）
    this.timer.onLevelChange = () => {
      this._renderLevelInfo();
      this._renderTimerOnly();
      this._renderTheme();
    };
    this.timer.onTimeUpdate = () => this._renderTimerOnly();
  }

  _renderAll() {
    this._renderTournamentInfo();
    this._renderTimerOnly();
    this._renderLevelInfo();
    this._renderRightPanel();
    this._renderTheme();
  }

  _renderTournamentInfo() {
    const data = this._loadTournamentData();
    if (this.tournamentNameEl) {
      this.tournamentNameEl.textContent = data.name || 'トーナメント名';
    }
  }

  _renderTimerOnly() {
    // 表示専用なので、毎回最新の localStorage を読んでから描画
    this.timer.loadData();
    if (!this.timerTextEl) return;

    this.timerTextEl.textContent = this.timer.getFormattedTime();

    // ブレイク中は CSS クラスで青にする（style.color で上書きしない）
    this.timerTextEl.classList.toggle('is-break', this.timer.isBreak);

    // 1分未満の色変更（ブレイク中じゃない時だけ）
    if (!this.timer.isBreak) {
      this.timerTextEl.style.color = this.timer.isUnderOneMinute() ? '#FFD700' : '';
    } else {
      this.timerTextEl.style.color = '';
    }

    // （あれば）Break中表示の ON/OFF
    if (this.breakIndicatorEl) {
      this.breakIndicatorEl.style.display = this.timer.isBreak ? 'block' : 'none';
    }
    // ブレイク中は current-level-info を非表示
    if (this.currentLevelInfoWrap) {
      this.currentLevelInfoWrap.style.display = this.timer.isBreak ? 'none' : '';
    }
  }

  _renderLevelInfo() {
    const cur = this.timer.getCurrentLevel();
    const next = this.timer.getNextLevel();

    if (this.currentLevelEl && this.currentSbEl && this.currentBbEl && this.currentAnteEl) {
      if (cur) {
        this.currentLevelEl.textContent = `Level ${this.timer.currentLevelIndex + 1}`;
        this.currentSbEl.textContent = cur.sb;
        this.currentBbEl.textContent = cur.bb;
        this.currentAnteEl.textContent = cur.ante;
      } else {
        this.currentLevelEl.textContent = '—';
        this.currentSbEl.textContent = '-';
        this.currentBbEl.textContent = '-';
        this.currentAnteEl.textContent = '-';
      }
    }

    if (this.nextSbEl && this.nextBbEl && this.nextAnteEl) {
      if (next) {
        this.nextSbEl.textContent = next.sb;
        this.nextBbEl.textContent = next.bb;
        this.nextAnteEl.textContent = next.ante;
      } else {
        this.nextSbEl.textContent = '-';
        this.nextBbEl.textContent = '-';
        this.nextAnteEl.textContent = '-';
      }
    }

    // ★「Level実行中に、次に予定されてるのが break か？」を判定
    let isNextThingBreak = false;
    if (!this.timer.isBreak) {
      const t = this.timer.getCurrentTimer();
      if (t && Array.isArray(t.breaks)) {
        // breaks の level は「そのレベルが終わった“後”」なので、
        // 今の currentLevelIndex に一致したら「このLevelの次はbreak」
        isNextThingBreak = t.breaks.some(b => b.level === this.timer.currentLevelIndex);
      }
    }

    if (this.nextBreakEl) {
      if (isNextThingBreak) {
        // 次がブレイク：next-blinds を隠して Break を大きく表示
        this.nextBreakEl.textContent = 'Break';
        this.nextBreakEl.classList.add('is-immediate-break');

        if (this.nextBlindsWrap) this.nextBlindsWrap.style.display = 'none';
      } else {
        // 通常：next-blinds を表示して「次のブレイク: 〇分後」を表示
        const nb = this.timer.getNextBreakTime();
        this.nextBreakEl.textContent = (nb !== null) ? `次のブレイク: ${nb}分後` : '次のブレイク: なし';
        this.nextBreakEl.classList.remove('is-immediate-break');

        if (this.nextBlindsWrap) this.nextBlindsWrap.style.display = '';
      }
    }
  }

  _renderRightPanel() {
    const data = this._loadTournamentData();
    if (!this.rewardListEl || !this.averageStackEl || !this.currentPlayersEl || !this.totalEntriesEl) return;

    // REWARD
    this.rewardListEl.innerHTML = '';
    const rewards = Array.isArray(data.rewards) ? data.rewards : [];
    rewards.forEach((reward, idx) => {
      const div = document.createElement('div');
      div.className = 'reward-item';
      div.innerHTML = `
        <span class="reward-rank">${idx + 1}位:</span>
        <span class="reward-value">${reward}</span>
      `;
      this.rewardListEl.appendChild(div);
    });

    // 平均スタック
    const currentPlayers = Number.isFinite(+data.currentPlayers) ? +data.currentPlayers : 0;
    const totalEntries = Number.isFinite(+data.totalEntries) ? +data.totalEntries : 0;
    const initialStack  = Number.isFinite(+data.initialStack) ? +data.initialStack : 10000;

    const totalChips = initialStack * totalEntries;
    const avg = currentPlayers > 0 ? Math.floor(totalChips / currentPlayers) : 0;
    this.averageStackEl.textContent = avg.toLocaleString();

    // 人数表示
    this.currentPlayersEl.textContent = currentPlayers || 0;
    this.totalEntriesEl.textContent = totalEntries || 0;
  }

  _renderTheme() {
    // 元の挙動を維持（不要ならここを消してOK）
    document.body.style.backgroundColor = this.timer.isBreak
      ? this.timer.settings.breakColor
      : this.timer.settings.normalColor;
  }

  _loadTournamentData() {
    const saved = localStorage.getItem('tournamentData');
    if (!saved) return {};
    try { return JSON.parse(saved) || {}; } catch { return {}; }
  }
}

// ページ起動
document.addEventListener('DOMContentLoaded', () => new MainDisplay());
