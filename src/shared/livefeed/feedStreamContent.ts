/**
 * Global social feed content — locale-matched nicknames + feed copy (display only).
 * Korean users → Korean nicknames/posts; each region → local language.
 */

export interface FeedPostTemplate {
  body: string;
  rewardRange: [number, number];
  weight?: number;
}

export interface HotMomentTemplate {
  action: string;
  amountRange: [number, number];
  weight?: number;
}

interface RegionProfile {
  id: string;
  flag: string;
  nicknames: readonly string[];
  posts: readonly FeedPostTemplate[];
  hotActions: readonly HotMomentTemplate[];
  weight: number;
}

const KR: RegionProfile = {
  id: "kr",
  flag: "🇰🇷",
  weight: 14,
  nicknames: [
    "포나라_드림",
    "민_차장",
    "예슬_엄마",
    "퇴근_요정",
    "크립토왕",
    "알바킹",
    "밤샘트레이더",
    "강남플레이어",
    "대학생_부업",
    "직장인_투자",
    "코인러버",
    "슬롯마스터",
    "출석왕",
    "친구초대왕",
    "육아맘_수익",
  ],
  posts: [
    { body: "크래시 {mult}배 캐시아웃 성공 🔥 한 판 더 갑니다", rewardRange: [80_000, 2_400_000], weight: 3 },
    { body: "출석 {days}일째! 보너스 받고 시작 🚀", rewardRange: [500, 10_000], weight: 2 },
    { body: "친구 {n}명 초대로 즉시 PHON 입금됨 💸", rewardRange: [10_000, 55_000], weight: 2 },
    { body: "육아하면서 한 달 누적 PHON 모음 👶", rewardRange: [50_000, 380_000], weight: 2 },
    { body: "슬롯 잭팟 터짐 🎰 아직도 믿기지 않아", rewardRange: [500_000, 12_000_000], weight: 1 },
    { body: "마인즈 {n}칸 클리어 — 깔끔하게 수익 💎", rewardRange: [8_000, 420_000], weight: 2 },
    { body: "VIP 등급 업! 그동안의 노력이 빛났어 👑", rewardRange: [25_000, 200_000], weight: 1 },
    { body: "플링코 {mult}배 대박 ☕ 출근 전에 한 판", rewardRange: [12_000, 890_000], weight: 2 },
    { body: "퇴근길 크래시 {mult}배 — 오늘 치킨 각 🍗", rewardRange: [30_000, 650_000], weight: 2 },
    { body: "미션 클리어하고 PHON 바로 받음 ✅", rewardRange: [1_000, 8_000], weight: 2 },
  ],
  hotActions: [
    { action: "크래시 {mult}× 캐시아웃", amountRange: [800_000, 12_000_000], weight: 3 },
    { action: "슬롯 잭팟 적중", amountRange: [2_000_000, 18_000_000], weight: 2 },
    { action: "플링코 {mult}× 메가윈", amountRange: [500_000, 5_000_000], weight: 2 },
    { action: "30일 연속 출석 보너스", amountRange: [200_000, 800_000], weight: 2 },
    { action: "친구 {n}명 초대 완료", amountRange: [25_000, 150_000], weight: 2 },
    { action: "럭키박스 레전더리 드랍", amountRange: [1_500_000, 9_000_000], weight: 1 },
    { action: "마인즈 퍼펙트 클리어", amountRange: [300_000, 3_200_000], weight: 2 },
  ],
};

const EN = (id: string, flag: string, weight: number, nicknames: string[]): RegionProfile => ({
  id,
  flag,
  weight,
  nicknames,
  posts: [
    { body: "Just cashed out {mult}x on Crash 🔥 one more round!", rewardRange: [50_000, 2_500_000], weight: 3 },
    { body: "Day {days} check-in streak — bonus unlocked 🚀", rewardRange: [500, 15_000], weight: 2 },
    { body: "Invited {n} friends and got instant PHON 💸", rewardRange: [5_000, 50_000], weight: 2 },
    { body: "Slots jackpot!!! Still shaking 🎰", rewardRange: [500_000, 12_000_000], weight: 1 },
    { body: "Mines cleared {n} tiles — clean run 💎", rewardRange: [8_000, 420_000], weight: 2 },
    { body: "Hit {mult}x on Plinko while waiting for coffee ☕", rewardRange: [12_000, 890_000], weight: 2 },
    { body: "VIP tier up! The grind paid off 👑", rewardRange: [25_000, 200_000], weight: 1 },
    { body: "Limbo {mult}x from a small bet — insane", rewardRange: [30_000, 1_800_000], weight: 2 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [800_000, 12_000_000], weight: 3 },
    { action: "Slots Jackpot Hit", amountRange: [2_000_000, 18_000_000], weight: 2 },
    { action: "Plinko {mult}× Mega Win", amountRange: [500_000, 5_000_000], weight: 2 },
    { action: "30-Day Streak Bonus", amountRange: [200_000, 800_000], weight: 2 },
    { action: "Referral {n} Friends", amountRange: [25_000, 150_000], weight: 2 },
    { action: "Lucky Box Legendary", amountRange: [1_500_000, 9_000_000], weight: 1 },
  ],
});

const ES = (id: string, flag: string, weight: number, nicknames: string[]): RegionProfile => ({
  id,
  flag,
  weight,
  nicknames,
  posts: [
    { body: "¡Retiré {mult}x en Crash! 🔥 otra ronda más", rewardRange: [40_000, 2_000_000], weight: 3 },
    { body: "Racha de {days} días — bono desbloqueado 🚀", rewardRange: [500, 12_000], weight: 2 },
    { body: "Invité {n} amigos — PHON instantáneo 💰", rewardRange: [8_000, 45_000], weight: 2 },
    { body: "Jackpot en slots 🎰 no puedo creerlo", rewardRange: [600_000, 9_000_000], weight: 1 },
    { body: "Mines {n} casillas — ronda perfecta 💎", rewardRange: [8_000, 380_000], weight: 2 },
    { body: "Subí de nivel VIP 👑 valió la pena", rewardRange: [20_000, 180_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [700_000, 11_000_000], weight: 3 },
    { action: "Jackpot de Slots", amountRange: [1_800_000, 16_000_000], weight: 2 },
    { action: "Plinko {mult}× Mega Win", amountRange: [450_000, 4_800_000], weight: 2 },
    { action: "Bono racha 30 días", amountRange: [180_000, 750_000], weight: 2 },
  ],
});

const PT = (id: string, flag: string, weight: number, nicknames: string[]): RegionProfile => ({
  id,
  flag,
  weight,
  nicknames,
  posts: [
    { body: "Cashout {mult}x no Crash agora 🔥", rewardRange: [35_000, 1_900_000], weight: 3 },
    { body: "Missão diária completa — +PHON na conta ✅", rewardRange: [1_000, 8_000], weight: 2 },
    { body: "Convidei {n} amigos — PHON na hora 💸", rewardRange: [7_000, 42_000], weight: 2 },
    { body: "Jackpot no slots 🎰 tremendo ainda", rewardRange: [550_000, 8_800_000], weight: 1 },
    { body: "Check-in {days} dias seguidos 🎁", rewardRange: [500, 11_000], weight: 2 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [750_000, 11_500_000], weight: 3 },
    { action: "Jackpot no Slots", amountRange: [1_900_000, 17_000_000], weight: 2 },
    { action: "Plinko {mult}× Mega Win", amountRange: [480_000, 5_200_000], weight: 2 },
  ],
});

const JP: RegionProfile = {
  id: "jp",
  flag: "🇯🇵",
  weight: 10,
  nicknames: ["サトシ_777", "ゆきトレーダー", "ハルキング", "れんプレイ", "あきマネー", "カイト_勝", "りなスロ", "ソラ投資", "タカ_win", "ミキちゃん"],
  posts: [
    { body: "Crashで{mult}倍キャッシュアウト成功！🔥", rewardRange: [60_000, 2_200_000], weight: 3 },
    { body: "連続{days}日ログインボーナス 🎁", rewardRange: [500, 12_000], weight: 2 },
    { body: "友達{n}人招待でPHON即入金 💸", rewardRange: [8_000, 48_000], weight: 2 },
    { body: "Plinkoで大当たり 💫", rewardRange: [20_000, 750_000], weight: 2 },
    { body: "スロットジャックポット 🎰 震えが止まらない", rewardRange: [520_000, 10_000_000], weight: 1 },
    { body: "VIPランクアップ 👑", rewardRange: [22_000, 190_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× キャッシュアウト", amountRange: [850_000, 12_500_000], weight: 3 },
    { action: "スロットジャックポット", amountRange: [2_100_000, 17_500_000], weight: 2 },
    { action: "Plinko {mult}× メガウィン", amountRange: [520_000, 5_100_000], weight: 2 },
    { action: "30日連続ログインボーナス", amountRange: [210_000, 820_000], weight: 2 },
  ],
};

const CN: RegionProfile = {
  id: "cn",
  flag: "🇨🇳",
  weight: 8,
  nicknames: ["_crypto小王", "赚钱达人", "夜猫子玩家", "深圳交易员", "幸运星88", "挖矿高手", "金币猎人"],
  posts: [
    { body: "Crash {mult}倍提现成功 🔥 再来一局", rewardRange: [45_000, 2_100_000], weight: 3 },
    { body: "连续{days}天签到奖励 🎁", rewardRange: [500, 11_000], weight: 2 },
    { body: "邀请了{n}个朋友 — PHON秒到账 💸", rewardRange: [9_000, 50_000], weight: 2 },
    { body: "老虎机大奖 🎰 太疯狂了", rewardRange: [580_000, 11_000_000], weight: 1 },
    { body: "VIP升级 👑 努力有回报", rewardRange: [24_000, 195_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× 提现", amountRange: [820_000, 12_200_000], weight: 3 },
    { action: "老虎机大奖", amountRange: [2_000_000, 18_500_000], weight: 2 },
    { action: "Plinko {mult}× 超级赢", amountRange: [490_000, 4_900_000], weight: 2 },
  ],
};

const TW: RegionProfile = {
  id: "tw",
  flag: "🇹🇼",
  weight: 5,
  nicknames: ["台北夜貓", "賺錢小能手", "幸運星_lin", "台中玩家", "加密貨幣王"],
  posts: [
    { body: "Crash {mult}倍提領成功 🔥 再來一把", rewardRange: [42_000, 2_000_000], weight: 3 },
    { body: "連續{days}天簽到獎勵 🎁", rewardRange: [500, 10_000], weight: 2 },
    { body: "邀請{n}位朋友 — PHON馬上入帳 💸", rewardRange: [8_000, 46_000], weight: 2 },
    { body: "拉霸大獎 🎰 手還在抖", rewardRange: [540_000, 10_500_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× 提領", amountRange: [780_000, 11_800_000], weight: 3 },
    { action: "拉霸大獎", amountRange: [1_950_000, 17_200_000], weight: 2 },
  ],
};

const VI: RegionProfile = {
  id: "vn",
  flag: "🇻🇳",
  weight: 7,
  nicknames: ["Minh_Trader", "Linh_Crypto", "Trung_Win", "Quan_88", "Thao_PHON", "Hanoi_King", "SaigonFlip"],
  posts: [
    { body: "Rút {mult}x trên Crash — quá đỉnh 🔥", rewardRange: [20_000, 1_200_000], weight: 3 },
    { body: "Check-in {days} ngày liên tiếp 🎁", rewardRange: [500, 9_000], weight: 2 },
    { body: "Mời {n} bạn — PHON về ngay 💸", rewardRange: [7_000, 40_000], weight: 2 },
    { body: "Jackpot slots 🎰 không tin được", rewardRange: [480_000, 8_200_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [650_000, 10_500_000], weight: 3 },
    { action: "Jackpot Slots", amountRange: [1_700_000, 15_500_000], weight: 2 },
  ],
};

const TH: RegionProfile = {
  id: "th",
  flag: "🇹🇭",
  weight: 5,
  nicknames: ["Somchai_Win", "Nong_Phon", "Bangkok_King", "Lucky_TH", "CoinHunter_TH"],
  posts: [
    { body: "Cashout {mult}x บน Crash — สุดยอด 🔥", rewardRange: [18_000, 980_000], weight: 3 },
    { body: "เช็คอิน {days} วันติด — โบนัสมาแล้ว 🎁", rewardRange: [500, 8_500], weight: 2 },
    { body: "ชวนเพื่อน {n} คน — PHON เข้าทันที 💸", rewardRange: [6_000, 38_000], weight: 2 },
    { body: "แจ็คพอตสล็อต 🎰 ยังสั่นอยู่", rewardRange: [450_000, 7_800_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [600_000, 10_000_000], weight: 3 },
    { action: "แจ็คพอตสล็อต", amountRange: [1_600_000, 14_800_000], weight: 2 },
  ],
};

const ID: RegionProfile = {
  id: "id",
  flag: "🇮🇩",
  weight: 7,
  nicknames: ["Budi_Cuan", "Sari_Win", "JakartaKing", "Raja_PHON", "Trader_ID", "Alif_88"],
  posts: [
    { body: "Cashout {mult}x di Crash — mantap 🔥", rewardRange: [22_000, 1_100_000], weight: 3 },
    { body: "Check-in hari ke-{days} — bonus cair 🎁", rewardRange: [500, 9_000], weight: 2 },
    { body: "Undang {n} teman — PHON langsung masuk 💸", rewardRange: [7_000, 41_000], weight: 2 },
    { body: "Jackpot slots 🎰 masih gemetar", rewardRange: [470_000, 8_500_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [680_000, 10_800_000], weight: 3 },
    { action: "Jackpot Slots", amountRange: [1_750_000, 15_800_000], weight: 2 },
  ],
};

const DE: RegionProfile = {
  id: "de",
  flag: "🇩🇪",
  weight: 5,
  nicknames: ["MaxWolf_DE", "BerlinTrader", "Lena_Win", "CryptoHans", "MunichFlip"],
  posts: [
    { body: "{mult}x Crash Cashout — geht weiter 🚀", rewardRange: [45_000, 1_700_000], weight: 3 },
    { body: "{days} Tage Streak — Bonus freigeschaltet 🎁", rewardRange: [500, 10_500], weight: 2 },
    { body: "{n} Freunde eingeladen — PHON sofort 💸", rewardRange: [8_000, 44_000], weight: 2 },
    { body: "Slots Jackpot 🎰 immer noch geschockt", rewardRange: [510_000, 9_200_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cashout", amountRange: [790_000, 11_600_000], weight: 3 },
    { action: "Slots Jackpot", amountRange: [1_880_000, 16_800_000], weight: 2 },
  ],
};

const FR: RegionProfile = {
  id: "fr",
  flag: "🇫🇷",
  weight: 5,
  nicknames: ["Lucas_FR", "Marie_Crypto", "ParisWin", "Trader_Lyon", "CoinKing_FR"],
  posts: [
    { body: "Cashout {mult}x sur Crash 🔥 encore une", rewardRange: [50_000, 2_100_000], weight: 3 },
    { body: "Série de {days} jours — bonus débloqué 🎁", rewardRange: [500, 10_000], weight: 2 },
    { body: "{n} amis invités — PHON instantané 💸", rewardRange: [8_000, 43_000], weight: 2 },
    { body: "Jackpot slots — je tremble encore 🎰", rewardRange: [400_000, 8_500_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [770_000, 11_400_000], weight: 3 },
    { action: "Jackpot Slots", amountRange: [1_850_000, 16_500_000], weight: 2 },
  ],
};

const RU: RegionProfile = {
  id: "ru",
  flag: "🇷🇺",
  weight: 5,
  nicknames: ["Dmitri_RU", "Алекс_Win", "Vlad_Trader", "MoscowKing", "Crypto_Ivan"],
  posts: [
    { body: "Crash {mult}x — krasiivo 🔥 ещё раунд", rewardRange: [40_000, 1_900_000], weight: 3 },
    { body: "Серия {days} дней — бонус получен 🎁", rewardRange: [500, 10_200], weight: 2 },
    { body: "Пригласил {n} друзей — PHON сразу 💸", rewardRange: [7_500, 42_000], weight: 2 },
    { body: "Джекпот в слотах 🎰 до сих пор в шоке", rewardRange: [490_000, 9_000_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [760_000, 11_200_000], weight: 3 },
    { action: "Джекпот слотов", amountRange: [1_820_000, 16_200_000], weight: 2 },
  ],
};

const TR: RegionProfile = {
  id: "tr",
  flag: "🇹🇷",
  weight: 5,
  nicknames: ["Emre_TR", "Ayse_Win", "IstanbulKing", "Trader_Ali", "CoinHunter_TR"],
  posts: [
    { body: "Crash'te {mult}x cashout yaptım 🔥", rewardRange: [35_000, 1_400_000], weight: 3 },
    { body: "{days} gün üst üste giriş — bonus geldi 🎁", rewardRange: [500, 9_500], weight: 2 },
    { body: "{n} arkadaş davet — PHON anında 💸", rewardRange: [7_000, 40_000], weight: 2 },
    { body: "Slot jackpot 🎰 hâlâ titriyorum", rewardRange: [460_000, 8_000_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [700_000, 10_600_000], weight: 3 },
    { action: "Slot Jackpot", amountRange: [1_700_000, 15_200_000], weight: 2 },
  ],
};

const HI: RegionProfile = {
  id: "in",
  flag: "🇮🇳",
  weight: 8,
  nicknames: ["Arjun_Patel", "Priya_Crypto", "MumbaiKing", "DesiTrader", "Rahul_Win", "CoinBhai"],
  posts: [
    { body: "Crash mein {mult}x cashout — mazaa aa gaya 🔥", rewardRange: [25_000, 1_500_000], weight: 3 },
    { body: "{days} din streak — bonus mil gaya 🎁", rewardRange: [500, 9_000], weight: 2 },
    { body: "{n} dost invite — PHON turant aaya 💸", rewardRange: [6_500, 39_000], weight: 2 },
    { body: "Slots jackpot 🎰 ab bhi yakeen nahi", rewardRange: [440_000, 7_600_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [640_000, 10_200_000], weight: 3 },
    { action: "Slots Jackpot", amountRange: [1_650_000, 14_500_000], weight: 2 },
  ],
};

const AR: RegionProfile = {
  id: "ar",
  flag: "🇸🇦",
  weight: 6,
  nicknames: ["Khalid_SA", "Omar_EG", "Ahmed_DXB", "Yusuf_Win", "Fawaz_Crypto", "RiyadhKing"],
  posts: [
    { body: "Cashout {mult}x fi Crash — mashallah 🔥", rewardRange: [30_000, 1_600_000], weight: 3 },
    { body: "سلسلة {days} أيام — المكافأة وصلت 🎁", rewardRange: [500, 10_000], weight: 2 },
    { body: "دعوت {n} أصدقاء — PHON فوراً 💸", rewardRange: [7_200, 41_000], weight: 2 },
    { body: "جاكبوت السلوت 🎰 لا أصدق", rewardRange: [500_000, 9_500_000], weight: 1 },
  ],
  hotActions: [
    { action: "Crash {mult}× Cash out", amountRange: [720_000, 11_000_000], weight: 3 },
    { action: "جاكبوت السلوت", amountRange: [1_780_000, 16_000_000], weight: 2 },
  ],
};

const REGIONS: readonly RegionProfile[] = [
  KR,
  EN("us", "🇺🇸", 9, ["CryptoKing_NY", "AlphaWolf", "ShadowFlip", "BlazeTrader", "PixelKing"]),
  EN("uk", "🇬🇧", 4, ["James_UK", "LondonFlip", "OxfordWin", "Crypto_Brit"]),
  EN("ca", "🇨🇦", 3, ["MapleTrader", "TorontoWin", "VancouverFlip"]),
  EN("au", "🇦🇺", 3, ["AussieFlip", "SydneyKing", "MelbourneWin"]),
  EN("ng", "🇳🇬", 4, ["Kemi_NG", "LagosKing", "AbujaWin"]),
  EN("ke", "🇰🇪", 3, ["Amina_KE", "NairobiFlip", "KenyaWin"]),
  EN("za", "🇿🇦", 3, ["Thabo_ZA", "JoburgKing", "CapeTrader"]),
  EN("sg", "🇸🇬", 4, ["Jay_SG", "LionCityWin", "SG_Flip"]),
  EN("ph", "🇵🇭", 4, ["Maria_PH", "ManilaKing", "PinoyWin"]),
  ES("mx", "🇲🇽", 5, ["Carlos_MX", "GuadalajaraWin", "Crypto_MX"]),
  ES("es", "🇪🇸", 4, ["Diego_ES", "MadridFlip", "BarcaWin"]),
  ES("arg", "🇦🇷", 4, ["Mateo_AR", "BuenosKing", "PampaWin"]),
  ES("co", "🇨🇴", 3, ["Sofia_CO", "BogotaFlip"]),
  ES("pe", "🇵🇪", 3, ["Luis_PE", "LimaWin"]),
  ES("cl", "🇨🇱", 3, ["Valentina_CL", "SantiagoKing"]),
  PT("br", "🇧🇷", 7, ["João_Silva", "RioTrader", "PauloWin", "Crypto_BR"]),
  PT("pt", "🇵🇹", 3, ["Rafa_PT", "LisboaFlip", "PortoWin"]),
  JP,
  CN,
  TW,
  VI,
  TH,
  ID,
  DE,
  FR,
  IT("it", "🇮🇹", 4, ["Marco_IT", "RomaWin", "MilanoFlip"]),
  NL("nl", "🇳🇱", 3, ["Daan_NL", "AmsterdamKing"]),
  SE("se", "🇸🇪", 3, ["Erik_SE", "StockholmWin"]),
  PL("pl", "🇵🇱", 3, ["Piotr_PL", "WarsawFlip"]),
  UA("ua", "🇺🇦", 3, ["Olena_UA", "KyivWin"]),
  PK("pk", "🇵🇰", 4, ["Ali_PK", "KarachiKing"]),
  BD("bd", "🇧🇩", 3, ["Rahim_BD", "DhakaWin"]),
  MY("my", "🇲🇾", 4, ["Hafiz_MY", "KL_Trader"]),
  RU,
  TR,
  HI,
  AR,
  { ...AR, id: "ae", flag: "🇦🇪", weight: 3, nicknames: ["Ahmed_DXB", "DubaiKing", "EmiratesWin"] },
  { ...AR, id: "eg", flag: "🇪🇬", weight: 3, nicknames: ["Omar_EG", "CairoFlip", "NileWin"] },
];

function IT(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    id,
    flag,
    weight,
    nicknames,
    posts: [
      { body: "Cashout {mult}x su Crash 🔥 ancora un round", rewardRange: [42_000, 1_950_000], weight: 3 },
      { body: "Serie di {days} giorni — bonus sbloccato 🎁", rewardRange: [500, 10_000], weight: 2 },
      { body: "Invitati {n} amici — PHON istantaneo 💸", rewardRange: [7_800, 43_500], weight: 2 },
      { body: "Jackpot slot 🎰 ancora scosso", rewardRange: [430_000, 8_300_000], weight: 1 },
    ],
    hotActions: [
      { action: "Crash {mult}× Cash out", amountRange: [740_000, 11_100_000], weight: 3 },
      { action: "Jackpot Slot", amountRange: [1_800_000, 16_000_000], weight: 2 },
    ],
  };
}

function NL(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return EN(id, flag, weight, nicknames);
}

function SE(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    ...EN(id, flag, weight, nicknames),
    posts: [
      { body: "{mult}x Crash cashout — kör igen 🔥", rewardRange: [40_000, 1_800_000], weight: 3 },
      { body: "{days} dagars streak — bonus upplåst 🎁", rewardRange: [500, 10_000], weight: 2 },
      { body: "Bjöd in {n} vänner — PHON direkt 💸", rewardRange: [7_500, 42_000], weight: 2 },
      { body: "Slots jackpot 🎰 chockad fortfarande", rewardRange: [460_000, 8_600_000], weight: 1 },
    ],
    hotActions: [
      { action: "Crash {mult}× Cashout", amountRange: [730_000, 11_000_000], weight: 3 },
      { action: "Slots Jackpot", amountRange: [1_750_000, 15_600_000], weight: 2 },
    ],
  };
}

function PL(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    ...EN(id, flag, weight, nicknames),
    posts: [
      { body: "Cashout {mult}x na Crash 🔥 jeszcze jedna runda", rewardRange: [38_000, 1_750_000], weight: 3 },
      { body: "Seria {days} dni — bonus odblokowany 🎁", rewardRange: [500, 9_800], weight: 2 },
      { body: "Zaprosiłem {n} znajomych — PHON od razu 💸", rewardRange: [7_200, 41_500], weight: 2 },
      { body: "Jackpot slotów 🎰 wciąż w szoku", rewardRange: [450_000, 8_400_000], weight: 1 },
    ],
    hotActions: [
      { action: "Crash {mult}× Cashout", amountRange: [710_000, 10_900_000], weight: 3 },
      { action: "Jackpot slotów", amountRange: [1_720_000, 15_400_000], weight: 2 },
    ],
  };
}

function UA(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    ...RU,
    id,
    flag,
    weight,
    nicknames,
  };
}

function PK(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return { ...HI, id, flag, weight, nicknames };
}

function BD(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    ...HI,
    id,
    flag,
    weight,
    nicknames,
    posts: [
      { body: "Crash e {mult}x cashout — daraun lageni 🔥", rewardRange: [20_000, 1_100_000], weight: 3 },
      { body: "{days} din streak — bonus peyechi 🎁", rewardRange: [500, 8_500], weight: 2 },
      { body: "{n} jon bondhu invite — PHON ekhnui 💸", rewardRange: [6_000, 36_000], weight: 2 },
    ],
  };
}

function MY(id: string, flag: string, weight: number, nicknames: string[]): RegionProfile {
  return {
    ...ID,
    id,
    flag,
    weight,
    nicknames,
    posts: [
      { body: "Cashout {mult}x kat Crash — power gila 🔥", rewardRange: [24_000, 1_150_000], weight: 3 },
      { body: "Check-in {days} hari berturut — bonus masuk 🎁", rewardRange: [500, 9_200], weight: 2 },
      { body: "Jemput {n} kawan — PHON terus masuk 💸", rewardRange: [6_800, 40_000], weight: 2 },
    ],
  };
}

/** @deprecated Use REGIONS — kept for legacy imports */
export const GLOBAL_USERS = REGIONS.flatMap((r) =>
  r.nicknames.slice(0, 2).map((name) => ({ flag: r.flag, name })),
);

export type FeedCurrency = "PHON" | "USDT";

function rollCurrency(): FeedCurrency {
  return Math.random() < 0.58 ? "PHON" : "USDT";
}

/** Map PHON-tier template ranges to realistic USDT payouts. */
function rollReward(currency: FeedCurrency, phonRange: [number, number]): number {
  if (currency === "PHON") {
    return randInt(phonRange[0], phonRange[1]);
  }
  const mid = (phonRange[0] + phonRange[1]) / 2;
  if (mid < 20_000) {
    return +(0.5 + Math.random() * 47.5).toFixed(2);
  }
  if (mid < 600_000) {
    return +(6 + Math.random() * 894).toFixed(2);
  }
  return +(95 + Math.random() * 9_905).toFixed(2);
}

export function pickWeightedRegion(): RegionProfile {
  const total = REGIONS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const region of REGIONS) {
    roll -= region.weight;
    if (roll <= 0) return region;
  }
  return REGIONS[REGIONS.length - 1];
}

function pickWeighted<T extends { weight?: number }>(items: readonly T[]): T {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randMult(): string {
  const r = Math.random();
  if (r < 0.7) return (1.5 + Math.random() * 18).toFixed(1);
  if (r < 0.95) return (20 + Math.random() * 80).toFixed(1);
  return (100 + Math.random() * 150).toFixed(1);
}

function fillTemplate(text: string): string {
  return text
    .replace(/\{mult\}/g, randMult())
    .replace(/\{days\}/g, String(randInt(3, 45)))
    .replace(/\{n\}/g, String(randInt(2, 12)));
}

function avatarFromName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0600-\u06ff]/g, "");
  if (cleaned.length > 0) return cleaned.slice(0, 1).toUpperCase();
  return name.slice(0, 1) || "P";
}

export function maskNickname(name: string, regionId: string): string {
  if (regionId === "kr") {
    if (name.length <= 2) return name[0] + "**";
    if (name.length <= 4) return name.slice(0, 1) + "**";
    return name.slice(0, 2) + "**" + name.slice(-1);
  }
  const base = name.replace(/[_\d]+/g, "").slice(0, 4);
  return base.length >= 2 ? base + "***" : name + "***";
}

export function randomGlobalUser(): { flag: string; name: string; regionId: string } {
  const region = pickWeightedRegion();
  return { flag: region.flag, name: pickOne(region.nicknames), regionId: region.id };
}

export function randomEngagement(): { likes: number; comments: number } {
  const tier = Math.random();
  const likes =
    tier < 0.4
      ? randInt(800, 4_999)
      : tier < 0.75
        ? randInt(5_000, 24_999)
        : tier < 0.95
          ? randInt(25_000, 89_999)
          : randInt(90_000, 340_000);
  const comments = Math.max(12, Math.round(likes * (0.04 + Math.random() * 0.12)));
  return { likes, comments };
}

export function generateFeedPost(): {
  user: string;
  flag: string;
  avatar: string;
  body: string;
  reward: number;
  currency: FeedCurrency;
  likes: number;
  comments: number;
  regionId: string;
} {
  const region = pickWeightedRegion();
  const user = pickOne(region.nicknames);
  const tpl = pickWeighted(region.posts);
  const currency = rollCurrency();
  const reward = rollReward(currency, tpl.rewardRange);
  const { likes, comments } = randomEngagement();
  const body = fillTemplate(tpl.body);
  const avatar = avatarFromName(user);
  return { user, flag: region.flag, avatar, body, reward, currency, likes, comments, regionId: region.id };
}

export function generateHotMoment(): {
  name: string;
  flag: string;
  action: string;
  amount: number;
  currency: FeedCurrency;
} {
  const region = pickWeightedRegion();
  const user = pickOne(region.nicknames);
  const tpl = pickWeighted(region.hotActions);
  const currency: FeedCurrency = Math.random() < 0.62 ? "PHON" : "USDT";
  const amount =
    currency === "PHON"
      ? randInt(tpl.amountRange[0], tpl.amountRange[1])
      : rollReward("USDT", tpl.amountRange);
  const action = fillTemplate(tpl.action);
  const masked = maskNickname(user, region.id);
  return { name: `${region.flag} ${masked}`, flag: region.flag, action, amount, currency };
}
