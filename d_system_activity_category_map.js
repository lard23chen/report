// d_system_activity_category_map.js
// Manually maintained ActivityId → category map for D系統 GA reports
// (generate_d_ga_funnel_report.js + generate_d_ga_traffic_daily.js both
// require this file — do not duplicate it, keep one source of truth).
const CAT_MAP = {
    '39590':'concert','39664':'concert','39226':'sports','39428':'sports',
    '39455':'sports', '39611':'concert','39667':'sports','39678':'kpop',
    '39496':'anime',  '39559':'concert','39649':'kpop',  '39451':'sports',
    '39584':'anime',  '39603':'kpop',   '39511':'sports','39458':'sports',
    '39682':'kpop',   '39680':'kpop',   '39494':'concert','38900':'concert',
    '39673':'kpop',   '39490':'anime',  '39453':'concert','39005':'sports',
    '39605':'kpop',   '39650':'concert','39555':'anime',  '39666':'sports',
    '39607':'kpop',   '39549':'kpop',   '39556':'anime',  '39527':'concert',
    '39696':'concert','39690':'concert','39689':'sports', '39692':'concert',
    '39665':'concert','39576':'sports', '39190':'sports', '39470':'concert',
    '39648':'sports', '39619':'concert','39524':'sports', '39526':'kpop',
    '39575':'kpop',   '39550':'kpop',   '39610':'concert',
};

module.exports = { CAT_MAP };
