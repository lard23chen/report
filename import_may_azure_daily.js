const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://QwareDashBoard:7hJpyIt33eNwoLro@for-aws-loadtest.f0fpg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

const records = [
    { Date: "2026/05/01", ASys: "28535", DSysAWS: "4959", ESys: "10722", Shared: "4925", Member: "4711", TotalRevenue: "53852", Level: "E系統-中型(免監控)\nE系統-中型(免監控)\nA系統-小型(小型監控)", Activity: "博麗神社歌謠祭2026　in　台灣\n丙午年過癮萬事屋慶讚高雄嘻哈派對大典\nEXILE AKIRA 20th ANNIVERSARY SPECIAL LIVE TOUR \"URBAN SAVAGE\" 台北公演 加場", Note: "" },
    { Date: "2026/05/02", ASys: "28826", DSysAWS: "4265", ESys: "8080", Shared: "2496", Member: "4041", TotalRevenue: "47709", Level: "A系統-小型(免監控)", Activity: "Pami in Taipei 2026", Note: "" },
    { Date: "2026/05/03", ASys: "22552", DSysAWS: "3988", ESys: "7960", Shared: "2358", Member: "3284", TotalRevenue: "40141", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/04", ASys: "28477", DSysAWS: "4100", ESys: "8101", Shared: "2486", Member: "4117", TotalRevenue: "47282", Level: "A系統-小型(小型監控)", Activity: "夢想家季後賽(全面)", Note: "" },
    { Date: "2026/05/05", ASys: "38607", DSysAWS: "4417", ESys: "8214", Shared: "2359", Member: "5625", TotalRevenue: "59222", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "統一獅Ｘ三麗鷗聯名主題日-季票優先購\n統一獅Ｘ三麗鷗聯名主題日-統一獅卡優先購", Note: "" },
    { Date: "2026/05/06", ASys: "28914", DSysAWS: "4155", ESys: "8658", Shared: "2624", Member: "5316", TotalRevenue: "49667", Level: "E系統-小型(小型監控)\nA系統-小型(免監控)", Activity: "2026屏東黑鮪魚文化觀光季-美食推廣宴活動\n統一獅Ｘ三麗鷗聯名主題日-兆豐獅卡優先購", Note: "" },
    { Date: "2026/05/07", ASys: "30520", DSysAWS: "4578", ESys: "8470", Shared: "45619", Member: "4318", TotalRevenue: "93506", Level: "A系統-小型(免監控)", Activity: "統一獅Ｘ三麗鷗聯名主題日-全面開賣", Note: "" },
    { Date: "2026/05/08", ASys: "23606", DSysAWS: "4778", ESys: "8172", Shared: "19625", Member: "3301", TotalRevenue: "59481", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/09", ASys: "37963", DSysAWS: "5668", ESys: "9505", Shared: "2725", Member: "4654", TotalRevenue: "60515", Level: "A系統-小型(小型監控)", Activity: "LUCY 9TH CONCERT ＜ISLAND＞ in Taipei", Note: "" },
    { Date: "2026/05/10", ASys: "22437", DSysAWS: "4756", ESys: "6895", Shared: "2410", Member: "3392", TotalRevenue: "39890", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/11", ASys: "31868", DSysAWS: "5083", ESys: "9834", Shared: "2688", Member: "4350", TotalRevenue: "53823", Level: "A系統-小型(小型監控)", Activity: "2026 T CONCERT《IDOL MEET FEST 偶像相遇祭》_早鳥", Note: "" },
    { Date: "2026/05/12", ASys: "65160", DSysAWS: "12075", ESys: "9626", Shared: "18202", Member: "8492", TotalRevenue: "113555", Level: "A系統-小型(免監控)\nA系統-小型(免監控)", Activity: "Jane Yeh Birthday Tour 2026 in Taipei-周邊商品6/12場次\nJane Yeh Birthday Tour 2026 in Taipei-周邊商品6/13場次", Note: "" },
    { Date: "2026/05/13", ASys: "145943", DSysAWS: "72857", ESys: "11826", Shared: "5762", Member: "15411", TotalRevenue: "251799", Level: "A系統-大型(小型監控)", Activity: "2026 7–ELEVEN 高雄啤酒音樂節-中信卡友優先購", Note: "" },
    { Date: "2026/05/14", ASys: "120515", DSysAWS: "90618", ESys: "10252", Shared: "15666", Member: "12373", TotalRevenue: "249424", Level: "A系統-大型(小型監控)\nA系統-大型(小型監控)", Activity: "2026 7–ELEVEN 高雄啤酒音樂節\n2026 角頭GATAO唱演會—情義到高雄", Note: "" },
    { Date: "2026/05/15", ASys: "48019", DSysAWS: "11661", ESys: "9857", Shared: "3089", Member: "7108", TotalRevenue: "79734", Level: "A系統-中型(小型監控)\nA系統-中型(小型監控)\nA系統-中型(小型監控)\nA系統-中型(小型監控)", Activity: "2026 蔡琴 不要告別 巡迴演唱會〔台北返場〕\n2026東海岸大地藝術節月光．海音樂會－澎湃的海\n2026 T CONCERT《IDOL MEET FEST 偶像相遇祭》_8/01場次\n2026 T CONCERT《IDOL MEET FEST 偶像相遇祭》_8/02場次", Note: "" },
    { Date: "2026/05/16", ASys: "60884", DSysAWS: "11567", ESys: "9004", Shared: "3376", Member: "8279", TotalRevenue: "93109", Level: "A系統-小型(小型監控)", Activity: "2026 FTISLAND TOUR 0 — XIX — III 'FaTe' in TAIPEI", Note: "" },
    { Date: "2026/05/17", ASys: "119550", DSysAWS: "24275", ESys: "9873", Shared: "5229", Member: "13796", TotalRevenue: "172724", Level: "A系統-中型(小型監控)\nA系統-中型(免監控)", Activity: "ACON 2026 IN TAIPEI\nCOSMOS 1st music concert in Taipei", Note: "" },
    { Date: "2026/05/18", ASys: "24309", DSysAWS: "7928", ESys: "8398", Shared: "2613", Member: "3357", TotalRevenue: "46605", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/19", ASys: "24332", DSysAWS: "5633", ESys: "8321", Shared: "2582", Member: "3360", TotalRevenue: "44227", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/20", ASys: "24274", DSysAWS: "5551", ESys: "8286", Shared: "7776", Member: "3336", TotalRevenue: "49223", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/21", ASys: "29358", DSysAWS: "5446", ESys: "10504", Shared: "3745", Member: "5056", TotalRevenue: "54109", Level: "E系統-小型(小型監控)\nA系統-小型(小型監控)", Activity: "斯巴達小勇士前哨站（非正式賽）\n夢想家冠軍賽", Note: "" },
    { Date: "2026/05/22", ASys: "25755", DSysAWS: "4875", ESys: "8568", Shared: "2960", Member: "3072", TotalRevenue: "45230", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/23", ASys: "22714", DSysAWS: "4673", ESys: "9860", Shared: "3083", Member: "3878", TotalRevenue: "44208", Level: "E系統-小型(免監控)", Activity: "CooMIC二元創庫4(核銷)", Note: "" },
    { Date: "2026/05/24", ASys: "27175", DSysAWS: "4677", ESys: "8242", Shared: "2884", Member: "3839", TotalRevenue: "46817", Level: "A系統-小型(小型監控)", Activity: "2026 角頭GATAO唱演會—情義到高雄_uniopen卡友優先購 (華貴執行高流)", Note: "" },
    { Date: "2026/05/25", ASys: "22956", DSysAWS: "4945", ESys: "9232", Shared: "2623", Member: "3068", TotalRevenue: "42825", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/26", ASys: "25325", DSysAWS: "4802", ESys: "8037", Shared: "2527", Member: "3075", TotalRevenue: "43766", Level: "A系統-小型(免監控)", Activity: "2026斯巴達障礙跑競賽新北場：中國信託uniopen聯名卡優先購專區", Note: "" },
    { Date: "2026/05/27", ASys: "22796", DSysAWS: "4569", ESys: "7193", Shared: "2531", Member: "3171", TotalRevenue: "40260", Level: "", Activity: "", Note: "" },
    { Date: "2026/05/28", ASys: "22648", DSysAWS: "4593", ESys: "11713", Shared: "2803", Member: "4359", TotalRevenue: "46116", Level: "E系統-小型(免監控)", Activity: "2026斯巴達障礙跑競賽新北場：OPENPOINT優先購專區", Note: "" },
    { Date: "2026/05/29", ASys: "36367", DSysAWS: "5055", ESys: "8603", Shared: "2791", Member: "4841", TotalRevenue: "57657", Level: "A系統-小型(小型監控)\nA系統-小型(免監控)\nA系統-小型(免監控)", Activity: "2026 角頭GATAO唱演會—情義到高雄_全面開賣 (華貴執行高流)\nTPBL冠軍賽　福爾摩沙夢想家主場\n2025－2026 桃園璞園領航猿主場", Note: "" },
    { Date: "2026/05/30", ASys: "22497", DSysAWS: "4630", ESys: "10709", Shared: "2675", Member: "3958", TotalRevenue: "44468", Level: "E系統-小型(免監控)", Activity: "2026斯巴達障礙跑競賽新北場：三色周末&2026斯巴達障礙跑競賽新北場：Kids 小勇士", Note: "" },
    { Date: "2026/05/31", ASys: "22552", DSysAWS: "4742", ESys: "8567", Shared: "2538", Member: "3195", TotalRevenue: "41594", Level: "", Activity: "", Note: "" },
];

async function run() {
    try {
        console.log(`Prepared ${records.length} records for 2026/05`);
        records.forEach(r => console.log(r.Date, r.ASys, r.TotalRevenue, r.Activity ? `[${r.Activity.split('\n')[0].substring(0, 30)}]` : ''));

        await client.connect();
        const col = client.db('QwareAi').collection('AzureMonthlyCost_Daily');

        const del = await col.deleteMany({ Date: { $regex: /^2026\/05\// } });
        console.log(`Deleted ${del.deletedCount} existing 2026/05 records`);

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
