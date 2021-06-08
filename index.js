const { resolve } = require('path');
const axios = require('axios');
const moment = require('moment');
const schedule = require('node-schedule');
const nconf = require('nconf');

nconf.file({ file: resolve(__dirname, './config/user.json') });

const time = moment(moment().subtract(3, 'days').format("YYYY-MM-DD")).unix()
const params = {
  "query": `
    {
      pairs(first: 100, where: {
        createdAtTimestamp_gte: ${time},
        volumeUSD_gte: 10000,
        txCount_gte: 100,
        reserveUSD_gte: 10000
      }) {
        id
        token0 {
          id
          name
          symbol
          tradeVolumeUSD
        }
        token1 {
          id
          name
          symbol
          tradeVolumeUSD
        }
        volumeUSD
        txCount
        reserveUSD
        createdAtTimestamp
      }
    }
  `
}

const tokenPools = new Set()
let currentPoolSize = tokenPools.size

function sendDD(content) {
  const url = nconf.get('dingdingWebHook');
  axios.post(url, {
    msgtype: "text",
    text: { content }
  })
}

async function getData() {
  const result = await axios.post('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', params)
  currentPoolSize = tokenPools.size
  each(result.data.data.pairs)
}

function getInt(s) {
  return s.slice(0, s.indexOf('.'))
}

function each(list) {
  list.forEach(item => {
    const {
      createdAtTimestamp,
      id,
      reserveUSD,
      txCount,
      volumeUSD,
      token0,
      token1
    } = item
    const createTime = moment.unix(createdAtTimestamp).format("YYYY/MM/DD hh:mm:ss");
    const txId = id
    const liquidity = reserveUSD
    const volume = volumeUSD
    const b = getInt(volume) / getInt(liquidity)

    tokenPools.add(token0.symbol)
    if (tokenPools.size !== currentPoolSize) {
      // 有新流动性添加
      sendDD(`uniswap
创建时间：${createTime}
交易ID：${txId}
流动总量：${getInt(liquidity)}
成交量：${getInt(volume)}
交易数量：${txCount}
代币：${token0.symbol}
代币名称：${token0.name}
代币ID：${token0.id}
代币交易总量：${getInt(token0.tradeVolumeUSD)}
Vol/Liq：${parseFloat(b).toFixed(1)}`);
    }
  });
}

schedule.scheduleJob('0 * * * * *', async function() {
  getData();
})