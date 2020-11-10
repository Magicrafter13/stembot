module.exports = {
	name: 'ping',
	description: 'Ping!',
	guildOnly: false,
	cooldown: 5,
	argsMin: 0,
	argsMax: -1,
	usage: '',
	execute(message, args) {
        message.channel.send(`Pong! This message had a latency of ${Date.now() - message.createdTimestamp}ms.`);
	},
};
