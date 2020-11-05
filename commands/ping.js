module.exports = {
	name: 'ping',
	description: 'Ping!',
	cooldown: 5,
	execute(message) {
        message.channel.send(`Pong! This message had a latency of ${Date.now() - message.createdTimestamp}ms.`);
	},
};
