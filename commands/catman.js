const Discord = require('discord.js');

function editMessage(message, data) {
	if (data.reactor.message === undefined) return;

	// Check if 'data' is from 'fieldMan' or 'fieldData'
	const type = data.fields !== undefined ? 'man' : 'data';

	const things = type === 'man'
		? data.fields.filter(f => f.emoji !== null).map(f => `${f.emoji} - ${f.prefix} Classes`).join('\n')
		: data.classes.filter(c => c.emoji !== null).map(c => `${c.emoji} - ${data.prefix} ${c.name}`).join('\n');
		
	const embed = new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(type === 'man'
		? 'Field Roles for this server!'
		: `Class Roles for ${message.guild.channels.cache.find(channel => channel.id === data.channel).name}`)
	.setAuthor('Clark Stembot', 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', 'https://gitlab.com/Magicrafter13/stembot')
	.setDescription(data.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'man' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use --set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter('WIP Dev Build - Caution is Advised!');

	const channel = message.guild.channels.cache.find(channel => channel.id === data.reactor.channel)
	channel.messages.fetch(data.reactor.message)
		.then(msg => {
			msg.edit('', embed)
				.then(() => {
					(type === 'man' ? data.fields : data.classes).forEach(t => {
						if (t.emoji !== null)
							msg.react(t.emoji);
					});
				})
			.catch(console.error);
		})
	.catch(console.error);
	return;
}

function deleteMessage(guild, reactor) {
	return guild.channels.cache.find(c => c.id === reactor.channel).messages.fetch(reactor.message)
	.then(message => message.delete({ reason: 'Old react-role message being deleted for new one.' }))
	.catch(console.error);
}

module.exports = {
	name: 'catman',
	description: 'Manage Class Subjects/Fields',
	guildOnly: true,
	cooldown: 0.5,
	argsMin: 1,
	argsMax: -1,
	execute(message, args, settings) {
		// Check if user has required permissions.
		const guildMember = message.guild.member(message.author);
		if (!guildMember.hasPermission('MANAGE_CHANNELS', { checkAdmin: true }) || !guildMember.hasPermission('MANAGE_ROLES', { checkAdmin: true }))
			return message.reply('You do not have adequate permissions for this command to work.\nRequires: MANAGE_CHANNELS and MANAGE_ROLES');

		const catDB = settings.get('categories');
		catDB.get(message.guild.id)
			.then(val => {
				let fieldMan;

				// Guild has no data in database yet
				if (val === undefined) {
					fieldMan = {
						fields: [],
						reactor: {
							message: null,
							channel: null,
							text: null,
						},
					};
				}
				else {
					fieldMan = val;

					// Guild has version 3.0 data = upgrade to 4
					if (val.fields === undefined) {
						fieldMan = {
							fields: val,
							reactor: {
								message: null,
								channel: null,
								text: null,
							},
						};
					}
				}

				// Check if no arguments were provided, or first argument is list command
				if (!args.length || args[0] === '-l' || args[0] === '--list')
					return message.channel.send(`The following roles have field information:\n${fieldMan.fields.map(arr => message.guild.roles.cache.find(role => role.id === arr.id).toString()).join('\n')}`)

				// Set field's emoji for react-role message.
				if (args[0] === '-se' || args[0] === '--set-emoji') {
					args.shift();

					// Get role request from message
					const roleStr = args.shift();
					const role = message.guild.roles.cache.find(role => role.toString() === roleStr);
					if (!role) return message.channel.send('2nd argument must be type: Role');

					const newEmoji = args.shift();

					const field = fieldMan.fields.find(field => field.id === role.id);
					if (!field) return message.channel.send('That field is not being managed/does not exist.');
					if (fieldMan.fields.find(f => f.emoji === newEmoji)) return message.channel.send('That emoji is already in use by another field!');
					field.emoji = newEmoji;
					editMessage(message, fieldMan);
					message.channel.send('Reaction emoji updated.');

					catDB.set(message.guild.id, fieldMan);
					return;
				}

				// Create master role reaction message
				if (args[0] === '-cm' || args[0] === '--create-message') {
					args.shift();
					if (fieldMan.fields.length === 0) return message.channel.send('There are no fields being managed yet, message would be pointless!');

					const channelStr = args.shift();
					const channel = message.guild.channels.cache.find(channel => channel.toString() === channelStr);
					if (channel === undefined) return message.channel.send('Channel doesn\'t exist.');

					// Delete previous reaction message if there is one.
					if (fieldMan.reactor.message !== null)
						deleteMessage(message.guild, fieldMan.reactor);

					channel.send('Please wait while embed is generated...')
						.then(newMessage => {
							fieldMan.reactor = {
								message: newMessage.id,
								channel: channel.id,
								text: args.length > 0 ? args.join(' ') : fieldMan.reactor.text,
							};
							editMessage(message, fieldMan);

							catDB.set(message.guild.id, fieldMan);
						})
					.catch(console.error);
					return;
				}

				// Get role request from message
				const roleStr = args.shift();
				const role = message.guild.roles.cache.find(role => role.toString() === roleStr);
				if (!role) return message.channel.send('1st argument must be type: Role');

				// Category information for specified role
				let catData = fieldMan.fields.find(c => c.id === role.id);
				const place = fieldMan.fields.indexOf(catData);
				if (catData !== undefined) {
					// Update catData (when users have data from older version of bot)
					// From Version 3
					if (catData.reactor === undefined) {
						catData = {
							id: catData.id,
							channel: catData.channel,
							prefix: catData.prefix,
							emoji: null,
							reactor: {
								message: undefined, // message ID
								channel: undefined, // guild (text) channel ID
								text: undefined,    // message body of embed
							},
							classes: (() => {
								let f = [];
								for (let i = 0; i < catData.classes.length; i++) {
									f.push({
										name: catData.classes[i],
										role: catData.roles[i],
										channel: catData.channels[i],
										emoji: null,
									});
								}
								return f;
							}) (),
						};
					}
				}

				let className, emoji, classIndex;

				const cmd = args.shift();
				switch (cmd) {
					case '-sc': case '--set-category':
						const catName = args.join(' ');
						const category = message.guild.channels.cache.find(channel => channel.name === catName);
						if (!category) return message.channel.send('3rd argument must be type: Channel Category Name');

						if (catData === undefined) {
							fieldMan.fields.push({
								id: role.id,
								channel: category.id,
								prefix: undefined,
								emoji: null,
								reactor: {
									message: undefined,
									channel: undefined,
									text: 'React to this message for roles!',
								},
								classes: [],
							});
							message.channel.send(`Created field info for ${role.toString()}, under category ${category.toString()}.`);
						}
						else {
							catData.channel = category.id;
							editMessage(message, catData); // Update embed message
							fieldMan.fields[place] = catData;
							message.channel.send(`Updated field category to ${category.toString()}.`);
						}
						break;
					case '-sp': case '--set-prefix':
						const prefix = args.shift();

						if (catData === undefined) {
							fieldMan.fields.push({
								id: role.id,
								channel: undefined,
								prefix: prefix,
								emoji: null,
								reactor: {
									message: undefined,
									channel: undefined,
									text: 'React to this message for roles!',
								},
								classes: [],
							});
							message.channel.send(`Created field info for ${role.toString()}, with prefix \`${prefix}\`.`);
						}
						else {
							catData.prefix = prefix;
							editMessage(message, catData); // Update embed message
							fieldMan.fields[place] = catData;
							message.channel.send(`Updated field prefix to \`${prefix}\`.`);
						}
						break;
					case '-cm': case '--create-message':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);
						if (catData.classes.length === 0) return message.channel.send('Field has no classes yet, message would be pointless!');

						const channelStr = args.shift();
						const channel = message.guild.channels.cache.find(channel => channel.toString() === channelStr);
						if (channel === undefined) return message.channel.send('Channel doesn\'t exist.');

						// Delete previous reaction message if there is one.
						if (catData.reactor.message !== undefined)
							deleteMessage(message.guild, catData.reactor);

						channel.send('Please wait while embed is generated...')
							.then(newMessage => {
								catData.reactor = {
									message: newMessage.id,
									channel: channel.id,
									text: args.length > 0 ? args.join(' ') : catData.reactor.text,
								};
								editMessage(message, catData);
								fieldMan.fields[place] = catData;

								catDB.set(message.guild.id, fieldMan);
							})
						.catch(console.error);
						break;
					case '-se': case '--set-emoji':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);

						className = args.shift().toLowerCase();
						const newEmoji = args.shift();

						const theClass = catData.classes.find(fClass => fClass.name === className);
						if (theClass === undefined) return message.channel.send('That class is not being managed/does not exist.');
						if (catData.classes.find(f => f.emoji === newEmoji) !== undefined) return message.channel.send('That emoji is already in use for this field!');
						theClass.emoji = newEmoji;
						editMessage(message, catData);
						fieldMan.fields[place] = catData;
						message.channel.send('Reaction emoji updated.');
						break;
					case '-p': case '--print':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);

						const classes = `Classes: [ ${catData.classes.map(c => c.name).join(', ')} ]`;
						const roles = `Roles: [ ${catData.classes.map(c => c.role).map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`;
						const channels = `Channels: [ ${catData.classes.map(c => c.channel).map(id => message.guild.channels.cache.find(channel => channel.id === id).toString()).join(', ')} ]`;
						emoji = `Emoji: [ ${catData.classes.map(c => c.emoji).join(', ')} ]`;
						return message.channel.send(`${catData.channel !== undefined ? `category: ${message.guild.channels.cache.find(channel => channel.id === catData.channel).toString()}` : 'no category'}\n${catData.prefix !== undefined ? `prefix: ${catData.prefix}` : 'no prefix'}\nReact Role Message: ${catData.reactor.channel !== undefined ? message.guild.channels.cache.find(channel => channel.id === catData.reactor.channel).messages.cache.find(msg => msg.id === catData.reactor.message).url : 'no message'}\n${classes}\n${roles}\n${channels}\n${emoji}`);
					case '-a': case '--add':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						if (catData.classes.indexOf(className) > -1) return message.channel.send(`${role.toString()} already contains this class.`);
						const classRole = message.guild.roles.cache.find(role => role.name.startsWith(`${catData.prefix} ${className}`));
						if (classRole === undefined) return message.channel.send(`No role found with name \`${catData.prefix} ${className}\`, you can create one by using \`-c\` instead of \`-a\`.`);
						const classChannel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${catData.prefix.toLowerCase()}${className}`) && channel.type === 'text')
						if (classChannel === undefined) return message.channel.send(`No channel found with name \`${catData.prefix.toLowerCase()}${className}, you can create one by using \`-c\` instead of \`-a\`.`);

						emoji = args.length > 0 ? args.shift() : null;

						message.channel.send(`Adding ${classRole.toString()} and ${classChannel.toString()} to ${role.toString()} field.${emoji !== null ? ` Emoji: ${emoji}.` : ''}`);

						catData.classes.push({
							name: className,
							role: classRole.id,
							channel: classChannel.id,
							emoji: emoji,
						});
						editMessage(message, catData); // Update embed message
						fieldMan.fields[place] = catData;
						break;
					case '-c': case '--create':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						if (catData.classes.find(c => c.name === className) !== undefined) return message.channel.send(`${role.toString()} already contains this class.`);

						emoji = args.length > 0 ? args.shift() : null;

						message.guild.roles.create({
							data: {
								name: `${catData.prefix} ${className}`,
								position: catData.classes.length === 0 ? null : message.guild.roles.cache.find(role => role.id === catData.classes[catData.classes.length - 1].role).position,
							},
							reason: `${message.author.username} added class ${className} to ${catData.prefix}.`,
						})
							.then(newRole => {
								message.guild.channels.create(`${catData.prefix}${className}`, {
									type: 'text',
									parent: message.guild.channels.cache.find(channel => channel.type === 'category' && channel.id === catData.channel),
									reason: `${message.author.username} added class ${className} to ${catData.prefix}.`,
								})
									.then(newChannel => {
										if (catData.classes.length)
											newChannel.setPosition(message.guild.channels.cache.find(channel => channel.id === catData.classes[catData.classes.length - 1].channel).rawPosition);
										message.channel.send(`Adding ${newRole.toString()} and ${newChannel.toString()} to ${role.toString()} info.${emoji !== null ? ` Emoji: ${emoji}.` : ''}`);

										catData.classes.push({
											name: className,
											role: newRole.id,
											channel: newChannel.id,
											emoji: null,
										});
										editMessage(message, catData); // Update embed message
										fieldMan.fields[place] = catData;

										catDB.set(message.guild.id, fieldMan);
									})
								.catch(console.error);
							})
						.catch(console.error);
						return;
					case '-r': case '--remove':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						classIndex = catData.classes.indexOf(catData.classes.find(c => c.name === className));
						if (classIndex === -1) return message.channel.send(`${role.toString()} doesn't contain this class.`);

						catData.classes.splice(classIndex, 1);
						fieldMan.fields[place] = catData;
						message.channel.send(`Removed \`${className}\` from list of classes.`);
						break;
					case '-d': case '--delete':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);
						if (catData.channel === undefined) return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
						if (catData.prefix === undefined) return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

						className = args.shift().toLowerCase();
						oldClass = catData.classes.find(c => c.name === className);
						if (oldClass === undefined) return message.channel.send(`${role.toString()} doesn't contain this class.`);
						classIndex = catData.classes.indexOf(oldClass);

						message.guild.roles.fetch(oldClass.role)
							.then(oldRole => {
								oldRole.delete(`${message.author.username} deleted ${className} from ${catData.prefix}.`)
									.then(() => {
										message.channel.send('Role deleted.');
										const oldChannelID = oldClass.channel;
										message.channel.send(`You may now delete ${message.guild.channels.cache.find(channel => channel.id === oldChannelID).toString()}.`);
										/*message.guild.channels.cache.find(channel => channel.id === oldChannelID).delete(`${message.author.username} deleted ${className} from ${catData.prefix}.`)
										.then(message.channel.send(`Channel deleted.`))
										.catch(console.error);*/
										catData.classes.splice(classIndex, 1);
										editMessage(message, catData); // Update embed message
										fieldMan.fields[place] = catData;

										catDB.set(message.guild.id, fieldMan);
									})
								.catch(console.error);
							})
						.catch(console.error);
						break;
					case '--purge':
						if (catData === undefined) return message.channel.send(`No field information set for ${role.toString()}`);

						// Cleanup react-role message if one exists.
						if (catData.reactor.message !== undefined)
							deleteMessage(message.guild, catData.reactor);

						fieldMan.fields.splice(place, 1);
						message.channel.send(`${role.toString()} field no longer being managed.`);
				}
				catDB.set(message.guild.id, fieldMan);
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
${prefix}catman (-l | --list)
${prefix}catman (-se | --set-emoji) <field> <emoji>
${prefix}catman (-cm | --create-message) <channel> (message)
${prefix}catman <role> (-sc | --set-category) <category_name>
${prefix}catman <role> (-sp | --set-prefix) <prefix>
${prefix}catman <role> (-se | --set-emoji) <class> <emoji>
${prefix}catman <role> (-cm | --create-message) <channel> (message)
${prefix}catman <role> --purge
${prefix}catman <role> (-a | -c | -r | -d) <class_number>
${prefix}catman <role> (-p | --print)

Without <role>
\t-l --list             Shows the fields currently stored in the manager (roles).
\t-se --set-emoji       Sets <field> to use <emoji> with role-react embed.
\t-cm --create-message  Creates a message in <channel> where users can click on
\t                      reactions to receive specific roles. Optional (message) to
\t                      display in the embed.
With <role>
\t-sc --set-category    Sets the Channel Category for this field to a category called
\t                      category_name (if one exists).
\t-sp --set-prefix      Sets the role/channel prefix for this field.
\t-se --set-emoji       Sets <class> to use <emoji> with role-react embed.
\t-cm --create-message  Creates a message in <channel> where users can click on
\t                      reactions to receive specific roles. Optional (message) to
\t                      display in the embed.
\t--purge               Deletes this field from the manager.
\t-a --add              Adds a role beginning with the field prefix, a space, and
\t                      class_number, and a channel beginning with field prefix, and
\t                      class_number.
\t-c --create           Creates a new role and channel, following the same convention
\t                      above.
\t-r --remove           Removes class_number from this field.
\t-d --delete           Removes class_number from this field, then deletes the role.
\t                      Channel must be deleted manually.
\t-p --print            Displays the information the manager has on this field.
`;
	},
}
