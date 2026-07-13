require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI_QWARE;
const client = new MongoClient(uri);

const records = [
    { Date: "2026/04/01", ASys: "24018", DSysAWS: "4477", ESys: "7746", Shared: "5379", Member: "3389", TotalRevenue: "45009", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/02", ASys: "29013", DSysAWS: "4616", ESys: "8706", Shared: "4117", Member: "4341", TotalRevenue: "50793", Level: "A系統-小型(免監控)", Activity: "《女神異聞錄 5》Persona 5 Special Big Band Concert-加場", Note: "" },
    { Date: "2026/04/03", ASys: "36591", DSysAWS: "5457", ESys: "8891", Shared: "3621", Member: "4456", TotalRevenue: "59016", Level: "A系統-小型(免監控)", Activity: "Jane Yeh Birthday Tour 2026 in Taipei", Note: "" },
    { Date: "2026/04/04", ASys: "23839", DSysAWS: "4377", ESys: "8302", Shared: "3188", Member: "3323", TotalRevenue: "43029", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/05", ASys: "23890", DSysAWS: "4345", ESys: "8171", Shared: "2952", Member: "3340", TotalRevenue: "42698", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/06", ASys: "28256", DSysAWS: "4601", ESys: "8143", Shared: "3007", Member: "4063", TotalRevenue: "48071", Level: "A系統-小型(免監控)", Activity: "The Sweet Escape – MablePangjie Fanmeeting in Taipei", Note: "" },
    { Date: "2026/04/07", ASys: "38639", DSysAWS: "4906", ESys: "8194", Shared: "45751", Member: "5402", TotalRevenue: "102891", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "Tk Nur－A Queens Time，A Sweet Night in Taipei-福利加購\n豐田裕大 Fan Meeting in Taipei 2026-SVIP", Note: "" },
    { Date: "2026/04/08", ASys: "31702", DSysAWS: "4586", ESys: "8107", Shared: "19673", Member: "4501", TotalRevenue: "68569", Level: "A系統-小型(免監控)", Activity: "豐田裕大 Fan Meeting in Taipei 2026-VIP", Note: "" },
    { Date: "2026/04/09", ASys: "32968", DSysAWS: "4591", ESys: "8220", Shared: "2871", Member: "5039", TotalRevenue: "53690", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "豐田裕大 Fan Meeting in Taipei 2026-一般區\nRed Bull BC One Cypher Taiwan", Note: "" },
    { Date: "2026/04/10", ASys: "48791", DSysAWS: "6057", ESys: "8726", Shared: "3416", Member: "7592", TotalRevenue: "74583", Level: "A系統-小型(免監控)\nA系統-中型(小型監控)", Activity: "Jane Yeh Birthday Tour 2026 in Taipei\n2am Concert ［O－NEUL，2am］ in Taipei", Note: "" },
    { Date: "2026/04/11", ASys: "22973", DSysAWS: "4597", ESys: "8314", Shared: "2738", Member: "3399", TotalRevenue: "42021", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/12", ASys: "27490", DSysAWS: "4824", ESys: "8280", Shared: "17276", Member: "4146", TotalRevenue: "62016", Level: "A系統-小型(免監控)", Activity: "OomBam 1st Fan Meeting in Taipei", Note: "" },
    { Date: "2026/04/13", ASys: "28569", DSysAWS: "4867", ESys: "8449", Shared: "2434", Member: "4217", TotalRevenue: "48536", Level: "A系統-小型(免監控)", Activity: "KAO SUPASSARA BIRTHDAY FAN MEETING-周邊商品", Note: "" },
    { Date: "2026/04/14", ASys: "45723", DSysAWS: "6394", ESys: "8921", Shared: "12981", Member: "4884", TotalRevenue: "78902", Level: "A系統-小型(小型監控)\nA系統-小型(免監控)", Activity: "NEXZ GLOBAL SHOWCASE EVENT ＜Mmchk：Not Typical＞ in TAIPEI\nThe Sweet Escape – MablePangjie Fanmeeting in Taipei-福利加購", Note: "" },
    { Date: "2026/04/15", ASys: "39568", DSysAWS: "5205", ESys: "11060", Shared: "3360", Member: "5919", TotalRevenue: "65111", Level: "A系統-中型(小型監控)\nE系統-中型(免監控)", Activity: "Solar '總有一顆屬於你的星球（Your Own Star）' LIVE 2026\n臺南總舖師四季辦桌．春季場", Note: "" },
    { Date: "2026/04/16", ASys: "27995", DSysAWS: "4662", ESys: "8131", Shared: "2865", Member: "4154", TotalRevenue: "47806", Level: "A系統-小型(免監控)", Activity: "《LA LA LAND IN CONCERT》樂來越愛你 電影交響音樂會", Note: "" },
    { Date: "2026/04/17", ASys: "22595", DSysAWS: "5430", ESys: "7020", Shared: "2759", Member: "3444", TotalRevenue: "41248", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/18", ASys: "58645", DSysAWS: "7832", ESys: "9757", Shared: "3320", Member: "7549", TotalRevenue: "87103", Level: "A系統-中型(小型監控)", Activity: "2026 EXID CONCERT EXID：EXtra ID in TAIPEI", Note: "" },
    { Date: "2026/04/19", ASys: "28626", DSysAWS: "5241", ESys: "8074", Shared: "2731", Member: "4285", TotalRevenue: "48957", Level: "A系統-小型(免監控)", Activity: "APPLEMIM 1st Weddind Meeting in TAIPEI", Note: "" },
    { Date: "2026/04/20", ASys: "28128", DSysAWS: "4702", ESys: "7845", Shared: "7343", Member: "4150", TotalRevenue: "52168", Level: "A系統-小型(免監控)", Activity: "KAO SUPASSARA BIRTHDAY FAN MEETING-周邊商品", Note: "" },
    { Date: "2026/04/21", ASys: "22566", DSysAWS: "5185", ESys: "6575", Shared: "2476", Member: "3434", TotalRevenue: "40236", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/22", ASys: "22727", DSysAWS: "4645", ESys: "8934", Shared: "2455", Member: "3496", TotalRevenue: "42257", Level: "", Activity: "", Note: "" },
    { Date: "2026/04/23", ASys: "29485", DSysAWS: "4660", ESys: "7913", Shared: "2656", Member: "4513", TotalRevenue: "49227", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "TPE48 – 期別 Fan meeting-會員優先購\nTPE48 – 一期生Special Performance《We Are 1st》-會員優先購", Note: "" },
    { Date: "2026/04/24", ASys: "35437", DSysAWS: "4977", ESys: "6965", Shared: "2456", Member: "5546", TotalRevenue: "55382", Level: "A系統-小型(免監控)\nA系統-小型(小型監控)", Activity: "GCS 2026春季準決暨冠軍賽-星展卡優先購\nEXILE AKIRA 20th ANNIVERSARY SPECIAL LIVE TOUR \"URBAN SAVAGE\" 台北公演", Note: "" },
    { Date: "2026/04/25", ASys: "36442", DSysAWS: "5416", ESys: "8324", Shared: "2407", Member: "5171", TotalRevenue: "57760", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "2026 春魚創意 3D Live《NEXUS 虛實之側》—＜Echo／迴響＞\nGCS 2026春季準決暨冠軍賽", Note: "" },
    { Date: "2026/04/26", ASys: "51266", DSysAWS: "6879", ESys: "9667", Shared: "3237", Member: "6702", TotalRevenue: "77751", Level: "A系統-小型(免監控)\nA系統-小型(小型監控)\nA系統-小型(小型監控)", Activity: "2026 春魚創意 3D／2D Live《NEXUS 虛實之側》—＜Threshold／臨界＞\n蔡琴 不要告別 巡迴演唱會 [2026加演場]\n2026 YANG YOSEOP SOLO CONCERT ＜Fade In＞ IN TAIPEI", Note: "" },
    { Date: "2026/04/27", ASys: "27201", DSysAWS: "4912", ESys: "6892", Shared: "2427", Member: "3959", TotalRevenue: "45391", Level: "A系統-小型(免監控)\nA系統-小型(免監控)\nA系統-小型(免監控)", Activity: "2026 EXID CONCERT EXID：EXtra ID in TAIPEI(加開5樓包廂)\nTPE48 – 期別 Fan meeting-全面開賣\nTPE48 – 一期生Special Performance《We Are 1st》-全面開賣", Note: "" },
    { Date: "2026/04/28", ASys: "38349", DSysAWS: "4770", ESys: "8968", Shared: "2576", Member: "5466", TotalRevenue: "60129", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "中華職棒37年例行賽統一獅主場（上）-嘉義場次-季票優先購\n中華職棒37年例行賽統一獅主場（上）嘉義場次-獅卡PLUS優先購", Note: "" },
    { Date: "2026/04/29", ASys: "29236", DSysAWS: "4793", ESys: "7792", Shared: "2524", Member: "4385", TotalRevenue: "48729", Level: "A系統-小型(免監控)", Activity: "中華職棒37年例行賽統一獅主場（上）嘉義場次-兆豐卡優先購", Note: "" },
    { Date: "2026/04/30", ASys: "29916", DSysAWS: "4441", ESys: "8260", Shared: "2586", Member: "4306", TotalRevenue: "49509", Level: "A系統-小型(免監控)", Activity: "中華職棒37年例行賽統一獅主場（上）嘉義場次-全面啟售", Note: "" },
];

async function run() {
    try {
        console.log(`Prepared ${records.length} records for 2026/04`);
        records.forEach(r => console.log(r.Date, r.ASys, r.TotalRevenue, r.Activity ? `[${r.Activity.split('\n')[0].substring(0, 30)}]` : ''));

        await client.connect();
        const col = client.db('QwareAi').collection('AzureMonthlyCost_Daily');

        const del = await col.deleteMany({ Date: { $regex: /^2026\/04\// } });
        console.log(`Deleted ${del.deletedCount} existing 2026/04 records`);

        const res = await col.insertMany(records);
        console.log(`Inserted ${res.insertedCount} records`);

        const total = await col.countDocuments();
        console.log(`Total documents in AzureMonthlyCost_Daily: ${total}`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

run();
