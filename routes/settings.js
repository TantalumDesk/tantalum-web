const express = require('express');
const router = express.Router();
const { db } = require('../db');

const DEFAULTS = {
  storeName:'',storePhone:'',storeEmail:'',storeAddress:'',
  taxRate:9,lastStockNum:2000,theme:'dark',fontSize:14,
  estimateExpiryDays:30,expiryAlertsEnabled:true,
  followupRemindersEnabled:true,birthdayRemindersEnabled:true,
  serviceLogEnabled:true,partsTrackerEnabled:true,
  brands:['Rolex','Tudor','Omega','Breitling','TAG Heuer','IWC','Panerai','Cartier','Patek Philippe','Audemars Piguet','Seiko','Grand Seiko','Zenith','Hublot','Hamilton'],
  models:['Submariner','Datejust','Day-Date','GMT-Master II','Explorer','Daytona','Sea-Dweller','Black Bay','Speedmaster','Seamaster','Navitimer','Carrera','Portuguese','Luminor','Santos','Nautilus','Royal Oak'],
  conditions:['Mint','Excellent','Very Good','Good','Fair','Parts/Repair'],
  watchAccessories:['Box & Papers','Box Only','Papers Only','None'],
  dialColors:['Black','White','Silver','Blue','Green','Grey','Champagne','Brown','Red','Salmon'],
  braceletTypes:['Oyster','Jubilee','President','Leather','Rubber','NATO','Mesh','Tropic'],
  statuses:['In Stock','Listed','Sold'],
  services:[],optionalPresets:[],workflowStatuses:[]
};

router.get('/', async (req, res) => {
  try {
    const rows = await db('settings').where({ user_id: req.session.userId });
    const settings = { ...DEFAULTS };
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
    res.json(settings);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await db('settings').insert({ user_id: req.session.userId, key, value: JSON.stringify(value) })
        .onConflict(['user_id','key']).merge();
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
