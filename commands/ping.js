module.exports = {
	name: 'ping',
	description: 'Ping!',
	execute(message) {
        message.channel.send(`Pong! This message had a latency of ${Date.now() - message.createdTimestamp}ms.`);
	},
};
