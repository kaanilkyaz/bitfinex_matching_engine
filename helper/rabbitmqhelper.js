const amqp = require('amqp-connection-manager');

let amqpConnection = amqp.connect('amqp://localhost', {
    heartbeatIntervalInSeconds: 1,
    reconnectTimeInSeconds: 1,
    connectionOptions: {
        noDelay: true,
        timeout: 1000,
        keepAlive: true
    }
});

amqpConnection.on("connect", function () {
    console.log("Connected to RabbitMq.");
});

amqpConnection.on("disconnect", function () {
    console.log("Disconnected from RabbitMq.");
});

const orderChannelWrapper = amqpConnection.createChannel({
    json: true,
    setup: function(channel) {
        return channel.assertQueue("order", {durable: true});
    }
});

const isConnectedToRabbitMq = () => {
    return amqpConnection.isConnected();
}

const produceOrderMessage = async (key, value) => {
    orderChannelWrapper.sendToQueue("order", { key, value });

}

module.exports = {
    isConnectedToRabbitMq,
    produceOrderMessage
}