const Discord = require('discord.js'); // Discord.js library - wrapper for Discord API

function editMessage(message, data) {
	if (!data.reactor.message)
		return;

	// Check if 'data' is from 'manager' or 'field'
	const type = data.fields ? 'manager' : 'field';

	const things = type === 'manager'
		//? data.fields.filter(field => field.emoji).map(field => `${field.emoji} - ${message.guild.channels.cache.find(c => c.id === f.channel).name} Classes`).join('\n')
		? data.fields.filter(field => field.emoji).map(field => `${field.emoji} - ${message.guild.channels.resolve(field.channel).name} Classes`).join('\n')
		: data.classes.filter(field_class => field_class.emoji).map(field_class => `${field_class.emoji} - ${data.prefix} ${field_class.name}`).join('\n');
		
	const embed = new Discord.MessageEmbed()
	.setColor(type === 'manager' ? '#cc8800' : '#0099ff')
	.setTitle(type === 'manager'
		? 'Roles for this server. (Fields)'
		//: `Class Roles for ${message.guild.channels.cache.find(c => c.id === data.channel).name}`)
		: `Class Roles for ${message.guild.channels.resolve(data.channel).name}`)
	.setAuthor('Clark Stembot', 'https://www.clackamas.edu/images/default-source/logos/nwac/clark_college_300x300.png', 'https://gitlab.com/Magicrafter13/stembot')
	.setDescription(data.reactor.text)
	//.setThumbnail('link')
	.addFields({ name: type === 'manager' ? 'Fields' : 'Classes', value: things === '' ? 'None set (use --set-emoji).' : things })
	//.setImage('link')
	.setTimestamp()
	.setFooter('WIP Dev Build - Caution is Advised!');

	//const channel = message.guild.channels.cache.find(c => c.id === data.reactor.channel)
	const channel = message.guild.channels.resolve(data.reactor.channel)
	channel.messages.fetch(data.reactor.message)
		.then(msg => {
			msg.edit('', embed)
				.then(() => {
					(type === 'man' ? data.fields : data.classes).forEach(t => {
						if (t.emoji)
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
	.then(m => m.delete({ reason: 'Old react-role message being deleted for new one.' }))
	.catch(console.error);
}

const newReactor = {
	message: null,
	channel: null,
	text: 'React to this message for roles!',
};

const newField = {
	id: null,
	channel: null,
	prefix: null,
	emoji: null,
	reactor: newReactor,
	classes: [],
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

		const fieldDB = settings.get('categories');
		fieldDB.get(message.guild.id)
			.then(async function (val) {
				let manager;

				// Guild has no data in database yet
				if (!val) {
					manager = {
						fields: [],
						reactor: newReactor,
					};
				}
				else {
					manager = val;

					// Guild has version 3.0 data = upgrade to 4
					if (!val.fields) {
						manager = {
							fields: val,
							reactor: newReactor,
						};
					}
				}

				let role, role_snowflake, emoji, field, channel;

				const command = !args.length ? '--list' : args.shift();

				switch (command) {
					// List fields currently in manager.
					case '-l': case '--list':
						return message.channel.send(`The following roles have field information:\n${manager.fields.map(f => message.guild.roles.cache.find(r => r.id === f.id).toString()).join('\n')}`)
					// Set field's emoji for react-role message.
					case '-se': case '--set-emoji':
						// Get role's snowflake from user, then resolve to role.
						role_snowflake = args.shift().replace(/^<@&(\d+)>$/, `$1`);
						//const role = message.guild.roles.cache.find(role => role.toString() === roleStr);
						role = message.guild.roles.resolve(role_snowflake);
						if (!role)
							return message.channel.send('2nd argument must be type: Role');

						emoji = args.shift();
						field = manager.fields.find(field => field.id === role.id);
						if (!field)
							return message.channel.send('That field is not being managed/does not exist.');
						if (manager.fields.find(f => f.emoji === newEmoji))
							return message.channel.send('That emoji is already in use by another field!');

						field.emoji = emoji;
						editMessage(message, manager);
						fieldDB.set(message.guild.id, manager);

						return message.channel.send('Reaction emoji updated.');
					// Create field react-role message.
					case '-cm': case '--create-message':
						if (!manager.fields.length)
							return message.channel.send('There are no fields being managed yet, message would be pointless!');

						const channel_snowflake = args.shift().replace(/^<#(\d+)>$/, `$1`);
						//const channel = message.guild.channels.cache.find(channel => channel.toString() === channelStr);
						channel = message.guild.channels.resolve(channel_snowflake);
						if (!channel)
							return message.channel.send('Channel doesn\'t exist.');

						// Delete previous reaction message if there is one.
						if (manager.reactor.message)
							deleteMessage(message.guild, manager.reactor);

						// Create message.
						channel.send('Please wait while embed is generated...')
							.then(newMessage => {
								// Save message and channel in reactor.
								manager.reactor = {
									message: newMessage.id,
									channel: channel.id,
									text: args.length ? args.join(' ') : manager.reactor.text,
								};
								// Generate embed.
								editMessage(message, manager);

								// Update database.
								fieldDB.set(message.guild.id, manager);
							})
						.catch(console.error);
						return;
					// Edit text of react-role message.
					case '-em': case '--edit-message':
						// Make sure there actually *is* a message to edit...
						if (!manager.reactor.message)
							return message.channel.send('There is no message! Create one with --create-message.');

						// Get new string from user's command, and update message.
						manager.reactor.text = args.join(' ');
						editMessage(message, manager);
						fieldDB.set(message.guild.id, manager);

						message.channel.send('Message text updated.');
						return;
					// No known command found, assume user specified a field role and wants to run one of those commands.
					default:
						// Get role request from message
						role_snowflake = command.replace(/^<@&(\d+)>$/, `$1`);
						//const role = message.guild.roles.cache.find(role => role.toString() === roleStr);
						role = message.guild.roles.resolve(role_snowflake);
						if (!role)
							return message.channel.send('1st argument must be type: Role');

						// Field information for specified role.
						// TODO figure out a way to make field a const
						field = manager.fields.find(field => field.id === role.id);
						const place = manager.fields.indexOf(field);
						if (field) {
							// Update field (when users have data from older version of bot)
							// From Version 3
							if (!field.reactor) {
								field = {
									id: field.id,
									channel: field.channel,
									prefix: field.prefix,
									emoji: null,
									reactor: newReactor,
									classes: (() => {
										let classes = [];
										for (let i = 0; i < field.classes.length; i++) {
											classes.push({
												name: field.classes[i],
												role: field.roles[i],
												channel: field.channels[i],
												emoji: null,
											});
										}
										return classes;
									}) (),
								};
							}
						}

						// Make sure reactor is cached (if it exists)
						if (field && field.reactor.message)
							await message.guild.channels.resolve(field.reactor.channel).messages.fetch(field.reactor.message);

						// Some general variable names shared among the cases...
						// TODO move as much of the code inside each case to a function as possible
						let class_name, old_class;

						const cmd = args.shift();
						switch (cmd) {
							case '-sc': case '--set-category':
								// Channel Categories cannot be tagged in a message, so we are forced to do a search by name.
								const category_name = args.join(' ');
								const category = message.guild.channels.cache.find(channel => channel.name === category_name);
								if (!category)
									return message.channel.send('3rd argument must be type: Channel Category Name');

								if (!field) {
									// Create new field object
									const new_field = newField;
									new_field.id = role.id;
									new_field.channel = category.id;

									// Add it to the manager
									manager.fields.push(new_field);

									message.channel.send(`Created field info for ${role.toString()}, under category ${category.toString()}.`);
								}
								else {
									// Update existing field object
									field.channel = category.id;
									// Update manager
									manager.fields[place] = field;
									// Update embed message
									editMessage(message, field);

									message.channel.send(`Updated field category to ${category.toString()}.`);
								}
								break;
							case '-sp': case '--set-prefix':
								// Get new field prefix from user
								const prefix = args.shift();

								if (!field) {
									// Create new field object
									const new_field = newField;
									new_field.id = role.id;
									new_field.prefix = prefix;
									// Add it to the manager
									manager.fields.push(new_field);

									message.channel.send(`Created field info for ${role.toString()}, with prefix \`${prefix}\`.`);
								}
								else {
									// Update field object
									field.prefix = prefix;
									// Update manager
									manager.fields[place] = field;
									// Update embed message
									editMessage(message, field);

									message.channel.send(`Updated field prefix to \`${prefix}\`.`);
								}
								break;
							case '-cm': case '--create-message':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.classes.length)
									return message.channel.send('Field has no classes yet, message would be pointless!');

								const channel_snowflake = args.shift().replace(/^<#(\d+)>$/, `$1`);
								//const channel = message.guild.channels.cache.find(channel => channel.toString() === channelStr);
								channel = message.guild.channels.resolve(channel_snowflake);
								if (!channel)
									return message.channel.send('Channel doesn\'t exist.');

								// Delete previous reaction message if there is one.
								if (field.reactor.message)
									deleteMessage(message.guild, field.reactor);

								channel.send('Please wait while embed is generated...')
									.then(message => {
										field.reactor = {
											message: message.id,
											channel: channel.id,
											text: args.length ? args.join(' ') : field.reactor.text,
										};
										manager.fields[place] = field;
										fieldDB.set(message.guild.id, manager);

										editMessage(message, field);
									})
								.catch(console.error);
								break;
							case '-em': case '--edit-message':
								// Make sure there actually *is* a message to edit...
								if (field.reactor.message)
									return message.channel.send('There is no message! Create one with --create-message.');

								// Get new string from user's command, and update message.
								field.reactor.text = args.join(' ');
								manager.fields[place] = field;
								editMessage(message, field);

								message.channel.send('Message text updated.');
								break;
							case '-se': case '--set-emoji':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								// Get class from user
								class_name = args.shift().toLowerCase();

								// Get emoji from user
								emoji = args.shift();

								// Get class (and make sure it exists)
								const the_class = field.classes.find(field_class => field_class.name === class_name);
								if (!the_class)
									return message.channel.send('That class is not being managed/does not exist.');

								// Check
								if (field.classes.find(field_class => field_class.emoji === emoji))
									return message.channel.send('That emoji is already in use for this field!');

								// Update class
								the_class.emoji = emoji;
								// Update manager
								manager.fields[place] = field;
								// Update embed
								editMessage(message, field);

								message.channel.send('Reaction emoji updated.');
								break;
							case '-p': case '--print':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								const classes = `Classes: [ ${field.classes.map(field_class => field_class.name).join(', ')} ]`;
								//const roles = `Roles: [ ${field.classes.map(field_class => field_class.role).map(id => message.guild.roles.cache.find(role => role.id === id).toString()).join(', ')} ]`;
								const roles = `Roles: [ ${field.classes.map(field_class => field_class.role).map(id => message.guild.roles.resolve(id).toString()).join(', ')} ]`;
								//const channels = `Channels: [ ${field.classes.map(field_class => field_class.channel).map(id => message.guild.channels.cache.find(channel => channel.id === id).toString()).join(', ')} ]`;
								const channels = `Channels: [ ${field.classes.map(field_class => field_class.channel).map(id => message.guild.channels.resolve(id).toString()).join(', ')} ]`;
								emoji = `Emoji: [ ${field.classes.map(field_class => field_class.emoji).join(', ')} ]`;
								const reactor = `React Role Message: ${field.reactor.channel && field.reactor.message ? message.guild.channels.resolve(field.reactor.channel).messages.cache.find(m => m.id === field.reactor.message).url : 'no message'}`;
								//return message.channel.send(`${field.channel ? `category: ${message.guild.channels.cache.find(channel => channel.id === fieldData.channel).toString()}` : 'no category'}\n${fieldData.prefix ? `prefix: ${fieldData.prefix}` : 'no prefix'}\nReact Role Message: ${fieldData.reactor.channel && fieldData.reactor.message ? message.guild.channels.cache.find(c => c.id === fieldData.reactor.channel).messages.cache.find(m => m.id === fieldData.reactor.message).url : 'no message'}\n${classes}\n${roles}\n${channels}\n${emoji}`);
								return message.channel.send(`${field.channel ? `category: ${message.guild.channels.resolve(field.channel).toString()}` : 'no category'}\n${field.prefix ? `prefix: ${field.prefix}` : 'no prefix'}\n${reactor}\n${classes}\n${roles}\n${channels}\n${emoji}`);
							case '-a': case '--add':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								// Get class from user
								class_name = args.shift().toLowerCase();
								if (field.classes.indexOf(class_name) > -1)
									return message.channel.send(`${role.toString()} already contains this class.`);

								// Find matching role
								const class_role = message.guild.roles.cache.find(role => role.name.startsWith(`${field.prefix} ${class_name}`));
								if (!class_role)
									return message.channel.send(`No role found with name \`${field.prefix} ${class_name}\`, you can create one by using \`-c\` instead of \`-a\`.`);

								// Find matching channel
								channel = message.guild.channels.cache.find(channel => channel.name.startsWith(`${field.prefix.toLowerCase()}${class_name}`) && channel.type === 'text')
								if (!channel)
									return message.channel.send(`No channel found with name \`${field.prefix.toLowerCase()}${class_name}, you can create one by using \`-c\` instead of \`-a\`.`);

								// Get emoji from user, or null of none specified
								emoji = args.length ? args.shift() : null;

								// Add new class to field
								field.classes.push({
									name: class_name,
									role: class_role.id,
									channel: channel.id,
									emoji: emoji,
								});
								// Update manager
								manager.fields[place] = field;
								// Update embed message
								editMessage(message, field);

								message.channel.send(`Adding ${class_role.toString()} and ${channel.toString()} to ${role.toString()} field.${emoji ? ` Emoji: ${emoji}.` : ''}`);
								break;
							case '-c': case '--create':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								// Get class from user
								class_name = args.shift().toLowerCase();
								if (field.classes.find(field_class => field_class.name === class_name))
									return message.channel.send(`${role.toString()} already contains this class.`);

								// Get emoji from user, null if none specified
								emoji = args.length ? args.shift() : null;

								// Create class role
								message.guild.roles.create({
									data: {
										name: `${field.prefix} ${class_name}`,
										//position: field.classes.length ? message.guild.roles.cache.find(role => role.id === fieldData.classes[fieldData.classes.length - 1].role).position : null,
										position: field.classes.length ? message.guild.roles.resolve(field.classes[field.classes.length - 1].role).position : null,
									},
									reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
								})
									.then(class_role => {
										message.guild.channels.create(`${field.prefix}${class_name}`, {
											type: 'text',
											//parent: message.guild.channels.cache.find(channel => channel.type === 'category' && channel.id === fieldData.channel),
											parent: message.guild.channels.resolve(field.channel),
											reason: `${message.author.username} added class ${class_name} to ${field.prefix}.`,
										})
											.then(class_channel => {
												if (field.classes.length)
													//class_channel.setPosition(message.guild.channels.cache.find(channel => channel.id === fieldData.classes[fieldData.classes.length - 1].channel).rawPosition);
													class_channel.setPosition(message.guild.channels.resolve(field.classes[field.classes.length - 1].channel).rawPosition);
												message.channel.send(`Adding ${class_role.toString()} and ${class_channel.toString()} to ${role.toString()} info.${emoji ? ` Emoji: ${emoji}.` : ''}`);

												// Add class to field
												field.classes.push({
													name: class_name,
													role: class_role.id,
													channel: class_channel.id,
													emoji: null,
												});
												// Update manager
												manager.fields[place] = field;
												// Update database
												fieldDB.set(message.guild.id, manager);
												// Update embed message
												editMessage(message, field);
											})
										.catch(console.error);
									})
								.catch(console.error);
								return;
							case '-r': case '--remove':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								// Get class from user
								class_name = args.shift().toLowerCase();
								// Get class from field
								old_class = field.classes.find(field_class => field_class.name === class_name);
								if (!old_class)
									return message.channel.send(`${role.toString()} doesn't contain this class.`);

								// Update field
								field.classes.splice(field.classes.indexOf(old_class), 1);
								// Update manager
								manager.fields[place] = field;
								// Update embed message
								if (field.reactor.message)
									editMessage(message, field);

								message.channel.send(`Removed \`${class_name}\` from list of classes.`);
								break;
							case '-d': case '--delete':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);
								if (!field.channel)
									return message.channel.send(`${role.toString()} has no channel category defined, please use \`-sc\`.`);
								if (!field.prefix)
									return message.channel.send(`${role.toString()} has no prefix defined, please use \`-sp\`.`);

								// Get class from user
								class_name = args.shift().toLowerCase();
								// Get class from field
								old_class = field.classes.find(field_class => field_class.name === class_name);
								if (!old_class)
									return message.channel.send(`${role.toString()} doesn't contain this class.`);

								// Update field
								field.classes.splice(field.classes.indexOf(old_class), 1);
								// Update manager
								manager.fields[place] = field;
								// Update database
								fieldDB.set(message.guild.id, manager);
								// Update embed message
								editMessage(message, field);

								// Delete role
								message.guild.roles.resolve(old_class.role).delete(`${message.author.username} deleted ${class_name} from ${field.prefix}.`)
								.then(message.channel.send('Role deleted.'))
								.catch(console.error);
								/*message.guild.channels.fetch(old_class.channel).delete(`${message.author.username} deleted ${class_name} from ${fieldData.prefix}.`)
								.then(message.channel.send('Channel deleted.'))
								.catch(console.error);*/
								// Delete channel (except not, because I'm still not sure I want the bot to have such power...)
								message.channel.send(`You may now delete ${message.guild.channels.resolve(old_class.channel).toString()}.`);
								break;
							case '--purge':
								if (!field)
									return message.channel.send(`No field information set for ${role.toString()}`);

								// Cleanup react-role message if one exists.
								if (field.reactor.message)
									deleteMessage(message.guild, field.reactor);

								// Update manager
								manager.fields.splice(place, 1);

								message.channel.send(`${role.toString()} field no longer being managed.`);
								break;
						}
						fieldDB.set(message.guild.id, manager);
				}
			})
		.catch(console.error);
	},
	help(prefix) {
		return `
Full documentation too long for Discord message, please see GitLab wiki for more!

${prefix}catman (-l | --list)
${prefix}catman [role] (-se | --set-emoji) <field/class> <emoji>
${prefix}catman [role] (-cm | --create-message) <channel> (message)
${prefix}catman <role> (-sc | --set-category) <category_name>
${prefix}catman <role> (-sp | --set-prefix) <prefix>
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
