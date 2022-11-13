'use strict'

const { PeerRPCServer }  = require('grenache-nodejs-http');
const Link = require('grenache-nodejs-link');
const rabbitmqHelper = require('./helper/rabbitmqhelper');
const numberHelper = require('./helper/numberHelper');
const AsyncLock = require('async-lock');
const lock = new AsyncLock();

const orderBook = [];
//{ orderId, customerId, sellingCurrencyId, buyingCurrencyId, amount, price, availableBalance }

const createOrder = async (order) => {

    if (!rabbitmqHelper.isConnectedToRabbitMq()) {
        return { status: 0, msg: 'Error on rabbit mq' };
    }
    
    const { customerId, sellingCurrencyId, buyingCurrencyId, amount, key, price } = order;

    //Check customer status first
    //const customer = await customerService.getCustomer(customer_id);
    //if(!customer.status) return { status: 0, msg: 'Anauthorized Customer'};

    //Check balance of the customer
    //if(amount < customer.availableBalance) return { status: 0, msg: 'Not enough balance'};

    //Check limit or market buy
    if(key === 'market') {
        //get last price of currency id from redis or mongo db
        //and set price with that last price
    }
    //if key is limit then use set price with price
    
    const orderId = numberHelper.generateUniqId();
    rabbitmqHelper.produceOrderMessage('order', orderId.toString());
    //add order with orderId to db 
    //await orderService.insertOrder(order);
    const availableBalance = amount * price;

    orderBook.push({ customerId, sellingCurrencyId, buyingCurrencyId, amount, price, availableBalance });
    return { status: 1, msg: 'order has been succesfully created' };
}

const matchOrder = async (order) => {
    const { customerId, sellingCurrencyId, buyingCurrencyId, amount, price } = order;
    let availableBalance = amount * price;

    lock.acquire(`matchOrder${buyingCurrencyId + '' + sellingCurrencyId}`, function(cb) { //Blocking race condition for specific buying and selling currency ids
        if(orderBook.length === 1){ //It means array has only that customer's order
            cb();
            return { status: 0, msg: 'Could not find any orders' };
        }

        // const matchOrders = orderBook.filter( o => o.buyingCurrencyId === sellingCurrencyId && o.sellingCurrencyId === buyingCurrencyId );

        // if(!matchOrders.length) {
        //     cb();
        //     return { status: 0, msg: 'could not find any orders with specific currencies' };
        // }
        let remaining = 0;
        for(const [index, ordr] of orderBook.entries()){
            if(!(ordr.buyingCurrencyId === sellingCurrencyId && ordr.sellingCurrencyId === buyingCurrencyId)){
                continue;
            }

            if(availableBalance < ordr.availableBalance){
                ordr.availableBalance = availableBalance - ordr.availableBalance;
                remaining = 0;
                break;
            } else {
                availableBalance -= ordr.availableBalance;
                remaining = availableBalance;
                orderBook.splice(index, 1);
            } 
        }
        if(remaining > 0) {
            orderBook.push({ customerId, sellingCurrencyId, buyingCurrencyId, amount: remaining / price, price, availableBalance: remaining});
            cb();
            return { status: 1, msg: 'Your order has been successfull partially matched' };
        }
        cb();
        return { status: 1, msg: 'Your order has been successfull matched' };
    }, 
    function(err, ret) {
        console.log("--------lock released ----------")
    });
}

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new PeerRPCServer(link, {
  timeout: 300000
})
peer.init()

const port = 1024 + Math.floor(Math.random() * 1000)
const service = peer.transport('server')
service.listen(port)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', async (rid, key, payload, handler) => {
  console.log(payload)
  const result = await createOrder(payload);
  if(!result.status) handler.reply(null, { status: result.status, msg: result.msg });
  const matchResult = await matchOrder(payload);
  handler.reply(null, { status: matchResult.status, msg: matchResult.msg })
})