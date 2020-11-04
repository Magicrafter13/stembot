module.exports = {
	name: 'add',
	description: 'Create new roles, and sort them properly.',
	execute(message, args) {
		var classes = ['CSE', 'Engr', 'Math', 'Phys'];
		switch (args.length) {
			case 2:
				const classType = classes.map(function(str) { return str.toLowerCase(); }).indexOf(args[0].toLowerCase());
				if (classType >= 0) {
					// There's probably a better way to check if the argument is a number besides using RegEx
					// May want to look into this later
					if (args[1].match(/^\d+$/))
						message.channel.send(`Okay, creating a role for ${classes[classType]} ${args[1]}.`);
					else
						message.channel.send(`err_syntax - ${args[1]} is not a positive integer.`);
				}
				else message.channel.send(`err_syntax - ${args[0]} is not a valid class type.`);
				break;
			default:
				message.channel.send('err_syntax - Command does not accept 0 arguments.');
				break;
		}
	},
};
