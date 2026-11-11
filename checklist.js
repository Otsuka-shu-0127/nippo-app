'use strict';
// 運行前点検の項目と、OK/NGの見本イラスト
// 見本はイメージ図です。実際の車両の写真（img/ フォルダ等）に差し替えできます。

const ILLUST = (() => {
  const INK = '#3b4654';
  const RED = '#d93025';
  const svg = (inner) =>
    `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" role="img"><rect width="240" height="160" rx="10" fill="#eef2f6"/>${inner}</svg>`;
  const t = (x, y, s, { size = 13, color = INK, anchor = 'start', weight = 400 } = {}) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${s}</text>`;
  const note = (ok, s) => t(120, 152, s, { size: 12, color: ok ? '#1e7a46' : RED, anchor: 'middle', weight: 700 });

  // 液量タンク（冷却水・ブレーキ液・ウォッシャー液・バッテリー）
  function tank(ok, { hi = 'MAX', lo = 'MIN', color = '#4a90d9', battery = false } = {}) {
    const level = ok ? 62 : 122;
    let s = '';
    if (battery) {
      s += `<rect x="95" y="10" width="12" height="10" fill="${INK}"/><rect x="133" y="10" width="12" height="10" fill="${INK}"/>`;
      s += t(101, 9, '−', { size: 11, anchor: 'middle' }) + t(139, 9, '+', { size: 11, anchor: 'middle' });
    }
    s += `<rect x="80" y="20" width="80" height="118" rx="10" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="82" y="${level}" width="76" height="${136 - level}" rx="6" fill="${color}" opacity=".75"/>`;
    s += `<line x1="160" y1="45" x2="182" y2="45" stroke="${INK}" stroke-width="2"/>` + t(186, 49, hi, { size: 12, weight: 700 });
    s += `<line x1="160" y1="108" x2="182" y2="108" stroke="${INK}" stroke-width="2"/>` + t(186, 112, lo, { size: 12, weight: 700 });
    if (!ok) s += `<path d="M58 70 v38 m-7 -9 l7 9 l7 -9" stroke="${RED}" stroke-width="3" fill="none"/>`;
    s += note(ok, ok ? `${hi}と${lo}の間にある` : `${lo}より下（不足）`);
    return svg(s);
  }

  // エンジンオイルのレベルゲージ
  function dipstick(ok) {
    const wet = ok ? 168 : 206;
    let s = `<circle cx="28" cy="72" r="13" fill="#f5c518" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="41" y="69" width="181" height="6" rx="3" fill="#9aa5b1"/>`;
    s += `<rect x="160" y="64" width="38" height="16" fill="none" stroke="${INK}" stroke-dasharray="3 2"/>`;
    s += t(160, 58, 'H', { size: 13, anchor: 'middle', weight: 700 }) + t(198, 58, 'L', { size: 13, anchor: 'middle', weight: 700 });
    s += `<rect x="${wet}" y="68" width="${222 - wet}" height="8" rx="3" fill="#7a5a1e" opacity=".9"/>`;
    s += t(120, 110, 'オイルが付いている範囲', { size: 11, anchor: 'middle' });
    s += `<line x1="${(wet + 222) / 2}" y1="80" x2="${(wet + 222) / 2}" y2="98" stroke="${INK}"/>`;
    s += note(ok, ok ? 'HとLの間にある' : 'Lより下（不足）');
    return svg(s);
  }

  // タイヤの空気圧
  function tirePressure(ok) {
    let s = `<line x1="20" y1="134" x2="220" y2="134" stroke="${INK}" stroke-width="2"/>`;
    if (ok) {
      s += `<circle cx="120" cy="78" r="56" fill="#2e3338"/><circle cx="120" cy="78" r="28" fill="#b8c0ca"/>`;
    } else {
      s += `<path d="M64 120 Q56 70 92 36 Q120 18 148 36 Q184 70 176 120 Q178 134 160 134 L80 134 Q62 134 64 120 Z" fill="#2e3338"/>`;
      s += `<circle cx="120" cy="80" r="26" fill="#b8c0ca"/>`;
      s += `<path d="M52 126 h-14 M188 126 h14" stroke="${RED}" stroke-width="3"/>`;
    }
    s += note(ok, ok ? '形が丸く、つぶれていない' : '接地面がつぶれている（空気不足）');
    return svg(s);
  }

  // タイヤの溝・亀裂
  function tread(ok) {
    const h = ok ? 34 : 9;
    let s = `<rect x="24" y="96" width="192" height="30" fill="#2e3338"/>`;
    for (let i = 0; i < 6; i++) {
      const x = 28 + i * 32;
      s += `<rect x="${x}" y="${96 - h}" width="24" height="${h}" fill="#2e3338"/>`;
    }
    // スリップサイン（溝の中の小さな山）
    s += `<rect x="116" y="88" width="8" height="8" fill="#6a737d"/>`;
    s += `<line x1="120" y1="86" x2="150" y2="40" stroke="${INK}"/>` + t(152, 38, 'スリップサイン', { size: 11 });
    if (!ok) {
      s += `<path d="M60 104 l6 8 l-4 6 M150 102 l-5 9 l6 7" stroke="${RED}" stroke-width="2.5" fill="none"/>`;
    }
    s += note(ok, ok ? '溝が十分ある' : '溝がない・ひび割れがある');
    return svg(s);
  }

  // ホイールナットのマーキング
  function wheelNuts(ok) {
    let s = `<circle cx="120" cy="74" r="62" fill="#c3cad3" stroke="${INK}" stroke-width="2"/><circle cx="120" cy="74" r="22" fill="#9aa5b1"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      const x = 120 + Math.cos(a) * 40, y = 74 + Math.sin(a) * 40;
      if (!ok && i === 5) {
        s += `<circle cx="${x}" cy="${y}" r="6" fill="#ffffff" stroke="${RED}" stroke-width="2"/>`;
        continue;
      }
      const ma = !ok && i === 2 ? a + 1.1 : a;
      s += `<circle cx="${x}" cy="${y}" r="8" fill="#59636e"/>`;
      s += `<line x1="${x}" y1="${y}" x2="${x + Math.cos(ma) * 14}" y2="${y + Math.sin(ma) * 14}" stroke="#f5c518" stroke-width="3"/>`;
      if (!ok && i === 2) s += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="${RED}" stroke-width="2"/>`;
    }
    s += note(ok, ok ? 'マーキングがそろっている' : 'マーキングがずれている・ナットがない');
    return svg(s);
  }

  // 灯火類（後ろから見た図）
  function lights(ok) {
    let s = `<rect x="40" y="14" width="160" height="96" rx="4" fill="#dfe4ea" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="34" y="112" width="172" height="20" rx="3" fill="#59636e"/>`;
    const lamp = (x, lit, color) => (lit
      ? `<circle cx="${x + 10}" cy="122" r="16" fill="${color}" opacity=".25"/><rect x="${x}" y="115" width="20" height="14" rx="3" fill="${color}"/>`
      : `<rect x="${x}" y="115" width="20" height="14" rx="3" fill="#8a9099"/><path d="M${x + 3} 117 l7 6 l-3 5 M${x + 12} 116 l4 9" stroke="${RED}" stroke-width="2" fill="none"/>`);
    s += lamp(46, true, '#f39c12') + lamp(70, true, '#e53935');
    s += lamp(150, ok, '#e53935') + lamp(174, true, '#f39c12');
    s += note(ok, ok ? 'すべて点灯・点滅する' : '点かない・割れている');
    return svg(s);
  }

  // メーター内の警告灯
  function warning(ok) {
    let s = `<rect x="16" y="18" width="208" height="104" rx="16" fill="#1e2530"/>`;
    s += `<circle cx="72" cy="68" r="36" fill="none" stroke="#5b6573" stroke-width="4"/><circle cx="168" cy="68" r="36" fill="none" stroke="#5b6573" stroke-width="4"/>`;
    s += `<line x1="72" y1="68" x2="52" y2="48" stroke="#ff8a00" stroke-width="3"/><line x1="168" y1="68" x2="150" y2="84" stroke="#ff8a00" stroke-width="3"/>`;
    const icon = (x, lit, color, label) =>
      `<circle cx="${x}" cy="108" r="8" fill="${lit ? color : '#3a4350'}"/>` + t(x, 112, label, { size: 10, color: lit ? '#fff' : '#5b6573', anchor: 'middle', weight: 700 });
    s += icon(96, !ok, RED, '!') + icon(120, !ok, '#f5a623', 'E') + icon(144, false, RED, 'B');
    s += note(ok, ok ? 'エンジン始動後、警告灯が消える' : '警告灯が点いたまま');
    return svg(s);
  }

  // ワイパー・ウォッシャー
  function wiper(ok) {
    let s = `<path d="M40 30 L200 30 L216 120 L24 120 Z" fill="#cfe3f3" stroke="${INK}" stroke-width="2"/>`;
    s += `<line x1="70" y1="118" x2="140" y2="52" stroke="${INK}" stroke-width="3"/><line x1="150" y1="118" x2="206" y2="70" stroke="${INK}" stroke-width="3"/>`;
    if (!ok) {
      for (let i = 0; i < 6; i++) s += `<path d="M${50 + i * 26} ${44 + (i % 2) * 8} q8 30 -4 64" stroke="#8a9aaa" stroke-width="2" fill="none" opacity=".8"/>`;
      s += `<ellipse cx="96" cy="70" rx="14" ry="8" fill="#9aa8b5" opacity=".7"/>`;
    }
    s += note(ok, ok ? 'きれいに拭き取れる' : 'すじ・ふき残しがある');
    return svg(s);
  }

  // ファンベルト
  function belt(ok) {
    let s = `<circle cx="70" cy="86" r="32" fill="#c3cad3" stroke="${INK}" stroke-width="2"/><circle cx="176" cy="58" r="22" fill="#c3cad3" stroke="${INK}" stroke-width="2"/>`;
    s += `<line x1="62" y1="55" x2="170" y2="37" stroke="#2e3338" stroke-width="5"/>`;
    s += ok
      ? `<line x1="78" y1="117" x2="182" y2="79" stroke="#2e3338" stroke-width="5"/>`
      : `<path d="M78 117 Q140 128 182 79" stroke="#2e3338" stroke-width="5" fill="none"/>`;
    if (!ok) s += `<path d="M110 40 l4 8 M122 38 l-3 9 M134 36 l4 8" stroke="${RED}" stroke-width="2.5"/>`;
    s += note(ok, ok ? '張りが適当・ひび割れなし' : 'たるみ・ひび割れがある');
    return svg(s);
  }

  // ブレーキペダル（横から見た図）
  function pedal(ok) {
    const py = ok ? 88 : 124;
    let s = `<rect x="20" y="136" width="200" height="6" fill="${INK}"/>`;
    s += `<circle cx="168" cy="22" r="6" fill="${INK}"/><line x1="168" y1="22" x2="118" y2="${py}" stroke="${INK}" stroke-width="6"/>`;
    s += `<rect x="96" y="${py - 4}" width="40" height="10" rx="3" fill="#59636e" transform="rotate(-20 116 ${py})"/>`;
    s += `<path d="M62 ${py + 4} V132 M56 ${py + 10} l6 -6 l6 6 M56 126 l6 6 l6 -6" stroke="${ok ? '#1e7a46' : RED}" stroke-width="2.5" fill="none"/>`;
    s += t(30, ok ? 114 : 118, ok ? '余裕' : '', { size: 12, weight: 700, color: '#1e7a46' });
    s += note(ok, ok ? '踏んだとき床との間に余裕がある' : '床近くまで沈む・効きが弱い');
    return svg(s);
  }

  // エア圧力計
  function gauge(ok) {
    let s = `<circle cx="120" cy="80" r="58" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
    s += `<path d="M78 112 A52 52 0 0 1 75 60" stroke="${RED}" stroke-width="8" fill="none"/>`;
    s += `<path d="M90 38 A52 52 0 0 1 168 104" stroke="#2ea05a" stroke-width="8" fill="none"/>`;
    const a = ok ? -0.4 : 3.3;
    s += `<line x1="120" y1="80" x2="${120 + Math.cos(a) * 44}" y2="${80 - Math.sin(a) * 44}" stroke="${INK}" stroke-width="4"/><circle cx="120" cy="80" r="6" fill="${INK}"/>`;
    s += t(120, 120, 'AIR', { size: 11, anchor: 'middle', weight: 700 });
    s += note(ok, ok ? '針が緑の範囲まで上がる' : '赤の範囲から上がらない');
    return svg(s);
  }

  // 液漏れ・車体
  function leak(ok) {
    let s = `<line x1="10" y1="128" x2="230" y2="128" stroke="${INK}" stroke-width="2"/>`;
    s += `<rect x="24" y="44" width="56" height="62" rx="6" fill="#4f7cac"/><rect x="34" y="52" width="34" height="20" rx="3" fill="#cfe3f3"/>`;
    s += `<rect x="84" y="24" width="132" height="82" rx="3" fill="#dfe4ea" stroke="${INK}" stroke-width="2"/>`;
    s += `<circle cx="56" cy="112" r="14" fill="#2e3338"/><circle cx="176" cy="112" r="14" fill="#2e3338"/><circle cx="200" cy="112" r="14" fill="#2e3338"/>`;
    if (!ok) {
      s += `<ellipse cx="74" cy="133" rx="30" ry="5" fill="#5a3d1a" opacity=".85"/>`;
      s += `<path d="M72 108 q-3 6 0 9 q3 -3 0 -9 M84 112 q-3 6 0 9 q3 -3 0 -9" fill="#5a3d1a"/>`;
      s += `<path d="M150 40 l10 12 l-6 6 l12 14" stroke="${RED}" stroke-width="2.5" fill="none"/>`;
    }
    s += note(ok, ok ? '車の下に液だまりがない' : 'オイル等の液漏れ・車体の損傷');
    return svg(s);
  }

  return {
    pedal, gauge, warning, wiper, dipstick, belt, tirePressure, tread, wheelNuts, lights, leak,
    coolant: (ok) => tank(ok, { hi: 'FULL', lo: 'LOW', color: '#3fae78' }),
    brakeFluid: (ok) => tank(ok, { hi: 'MAX', lo: 'MIN', color: '#d9a62e' }),
    washer: (ok) => tank(ok, { hi: 'FULL', lo: 'LOW', color: '#4a90d9' }),
    battery: (ok) => tank(ok, { hi: 'UPPER', lo: 'LOWER', color: '#8fb3d9', battery: true }),
  };
})();

// 紙の「日常点検表」と同じ並び・同じ言葉にしている
// group = 点検箇所、point = 点検内容（記号も紙のとおり）、name = 記録・CSVで使う名前
// ※ … 走行距離や運行時の状態などから判断した適切な時期に実施
// ◎ … エア・ブレーキが装備されている場合に実施
// インターロック・連結部は、紙の表で黒塗り（対象外）のため入れていない
const CHECK_NOTES = [
  ['※', '走行距離や運行時の状態などから判断した適切な時期に実施'],
  ['◎', 'エア・ブレーキが装備されている場合に実施'],
];

const CHECKLIST = [
  {
    category: '準備',
    items: [
      { id: 'prev_issue', group: '前日の異常箇所の確認', point: '前日に異常があった箇所が直っている', name: '前日の異常箇所の確認', img: null,
        ok: '前日は異常なし、または修理済み', ng: '前日の異常が直っていない' },
    ],
  },
  {
    category: '運転席での点検',
    items: [
      { id: 'brake_pedal', group: 'ブレーキ・ペダル', point: '踏みしろ、効き具合', name: 'ブレーキ・ペダル', img: 'pedal',
        ok: '踏んだときに床との間に余裕があり、しっかり止まる', ng: '床近くまで沈む、効きが弱い、片効きする' },
      { id: 'parking_brake', group: '駐車（パーキング）ブレーキ', point: 'レバーの引きしろ', name: '駐車ブレーキ', img: null,
        ok: '決められたノッチ数で確実に効く', ng: '引きしろが大きすぎる、坂道で車が動く' },
      { id: 'engine', group: 'エンジン', point: '※ かかり具合、異音', name: 'エンジンのかかり具合・異音', img: null,
        ok: 'すぐにかかり、異音・異常な振動がない', ng: 'かかりにくい、異音・異臭がある' },
      { id: 'engine_accel', group: 'エンジン', point: '※ 低速、加速の状態', name: 'エンジンの低速・加速', img: null,
        ok: 'アイドリングが安定し、スムーズに加速する', ng: 'エンストしそう、加速がもたつく、黒煙が出る' },
      { id: 'washer', group: 'ウインド・ウォッシャ', point: '※ 液量、噴射状態', name: 'ウインド・ウォッシャ', img: 'washer',
        ok: '液が十分あり、正しい位置に噴射する', ng: '液が少ない・出ない、噴射の向きがずれている' },
      { id: 'wiper', group: 'ワイパー', point: '※ 拭き取りの状態', name: 'ワイパー', img: 'wiper',
        ok: 'すじ・ふき残しがなく、きれいに拭き取れる', ng: 'すじが残る、ゴムが切れている' },
      { id: 'air_pressure', group: '◎ 空気圧力計', point: '空気圧力の上がり具合', name: '空気圧力計', img: 'gauge',
        ok: 'エンジンをかけて数分で、針が規定の範囲まで上がる', ng: 'なかなか上がらない、警報が鳴りやまない' },
      { id: 'brake_valve', group: '◎ ブレーキ・バルブ', point: '排気音の異常', name: 'ブレーキ・バルブ', img: null,
        ok: 'ブレーキを踏んで離したとき、正常な排気音がする', ng: '排気音がしない、エア漏れの音がする' },
      { id: 'brake_chamber', group: '◎ ブレーキ・チャンバ', point: '※ ロッドのストローク', name: 'ブレーキ・チャンバ', img: null,
        ok: 'ブレーキを踏んだときのロッドの動きが規定の範囲', ng: 'ストロークが大きすぎる、左右で差がある' },
      { id: 'brake_drum', group: '◎ ブレーキ・ドラムとライニング', point: '※ すき間', name: 'ブレーキ・ドラムとライニング', img: null,
        ok: 'ドラムとライニングのすき間が適当', ng: 'すき間が大きい、引きずりがある' },
    ],
  },
  {
    category: 'エンジン・ルームの点検',
    items: [
      { id: 'brake_fluid', group: 'ブレーキ液・オイル（リザーバ・タンク）', point: '液量、漏れ', name: 'ブレーキ液・オイル', img: 'brakeFluid',
        ok: 'MAXとMINの間で、漏れがない', ng: 'MINより下、タンクの周りに漏れの跡がある' },
      { id: 'battery', group: 'バッテリー', point: '※ 液量', name: 'バッテリー液量', img: 'battery',
        ok: 'UPPERとLOWERの間', ng: 'LOWERより下' },
      { id: 'coolant', group: '原動機', point: '※ 冷却水の量', name: '冷却水の量', img: 'coolant',
        ok: 'リザーバ・タンクのFULLとLOWの間', ng: 'LOWより下、漏れの跡がある' },
      { id: 'oil', group: '原動機', point: '※ エンジン・オイルの量', name: 'エンジン・オイルの量', img: 'dipstick',
        ok: 'レベルゲージのHとLの間', ng: 'Lより下、または汚れがひどい' },
      { id: 'belt', group: '▲ ファン・ベルト', point: '※ 張り具合、損傷', name: 'ファン・ベルト', img: 'belt',
        ok: '指で押して適度な張りがあり、傷がない', ng: 'たるみ、ひび割れ、ほつれがある' },
    ],
  },
  {
    category: '車の周りからの点検',
    items: [
      { id: 'lights', group: '灯火装置、方向指示器', point: '点灯・点滅具合、汚れ、損傷、レンズ・反射板の変色', name: '灯火装置・方向指示器', img: 'lights',
        ok: 'すべて点灯・点滅し、汚れ・割れ・変色がない', ng: '点かない、レンズが割れている・変色している' },
      { id: 'tire_pressure', group: 'タイヤ', point: '空気圧', name: 'タイヤの空気圧', img: 'tirePressure',
        ok: 'つぶれておらず、ほかのタイヤと差がない', ng: '接地面がつぶれている、空気が抜けている' },
      { id: 'wheel_nut', group: 'タイヤ', point: '■ ディスク・ホイールの取付状態', name: 'ディスク・ホイールの取付状態', img: 'wheelNuts',
        ok: 'ナットのマーキングがそろっている', ng: 'マーキングがずれている、ナットがない、さび汁がある' },
      { id: 'tire_crack', group: 'タイヤ', point: '亀裂・損傷', name: 'タイヤの亀裂・損傷', img: null,
        ok: '亀裂・傷がなく、釘などが刺さっていない', ng: 'ひび割れ・傷がある、釘が刺さっている' },
      { id: 'tire_wear', group: 'タイヤ', point: '異常な摩耗', name: 'タイヤの異常な摩耗', img: null,
        ok: '片減り・段減りがない', ng: '片側だけ減っている、段減りがある' },
      { id: 'tire_tread', group: 'タイヤ', point: '※★ 溝の深さ', name: 'タイヤの溝の深さ', img: 'tread',
        ok: '溝が十分あり、スリップサインが出ていない', ng: 'スリップサインが出ている、溝が浅い' },
      { id: 'air_tank', group: '◎ エア・タンク', point: 'タンク内の凝水', name: 'エア・タンクの凝水', img: null,
        ok: 'ドレンコックを開けても水がほとんど出ない', ng: '水がたくさん出る' },
    ],
  },
  {
    category: 'その他',
    items: [
      { id: 'equipment', group: 'スペア・タイヤ、工具、停止表示板、チャート紙、★タイヤチェーン', point: '積んであり、使える状態', name: '備品（スペア・タイヤ、工具など）', img: null,
        ok: 'すべて積んであり、使える', ng: '足りないもの・使えないものがある' },
      { id: 'documents', group: '車検証、保険証、点検整備記録簿、非常信号用具', point: '車内にある', name: '書類・非常信号用具', img: null,
        ok: 'すべて車内にある', ng: '見当たらないものがある' },
    ],
  },
];
