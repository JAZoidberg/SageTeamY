import { BOT, DB } from '@root/config';
import {
   ApplicationCommandOptionData,
   ChatInputCommandInteraction,
   InteractionResponse,
   ActionRowBuilder,
   ButtonBuilder,
   ButtonStyle,
   ComponentType,
   ModalBuilder,
   TextInputBuilder,
   TextInputStyle,
   ModalSubmitInteraction
} from 'discord.js';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { checkJobReminder, reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';


export default class extends Command {
   description = `Have ${BOT.NAME} give you a reminder.`;
   extendedHelp = 'Choose to create either a regular reminder or a job reminder.';
   options: ApplicationCommandOptionData[] = []; // No options needed as we're using buttons


   async run(
       interaction: ChatInputCommandInteraction
   ): Promise<InteractionResponse<boolean> | void> {
       // Create buttons for the two options
       const row = new ActionRowBuilder<ButtonBuilder>()
           .addComponents(
               new ButtonBuilder()
                   .setCustomId('create_reminder')
                   .setLabel('CREATE REMINDER')
                   .setStyle(ButtonStyle.Primary),
               new ButtonBuilder()
                   .setCustomId('create_job_reminder')
                   .setLabel('CREATE JOB REMINDER')
                   .setStyle(ButtonStyle.Secondary)
           );


       // Send the initial message with buttons
       const response = await interaction.reply({
           content: 'What type of reminder would you like to create?',
           components: [row],
           ephemeral: true
       });


       // Create collector for button interactions
       const collector = response.createMessageComponentCollector({
           componentType: ComponentType.Button,
           time: 60000 // 1 minute timeout
       });


       collector.on('collect', async (buttonInteraction) => {
           // Handle button clicks
           if (buttonInteraction.customId === 'create_reminder') {
               await this.handleCreateReminder(buttonInteraction);
           } else if (buttonInteraction.customId === 'create_job_reminder') {
               await this.handleCreateJobReminder(buttonInteraction);
           }
       });


       collector.on('end', async (collected) => {
           if (collected.size === 0) {
               await interaction.editReply({
                   content: 'Reminder creation timed out.',
                   components: []
               });
           }
       });
   }


   // Handle creating a standard reminder via a modal
   private async handleCreateReminder(buttonInteraction: any) {
       // Create modal for reminder details
       const modal = new ModalBuilder()
           .setCustomId('reminder_modal')
           .setTitle('Create Reminder');


       // Add inputs for content and duration
       const contentInput = new TextInputBuilder()
           .setCustomId('content')
           .setLabel("What would you like to be reminded of")
           .setStyle(TextInputStyle.Paragraph)
           .setRequired(true);


       const durationInput = new TextInputBuilder()
           .setCustomId('duration')
           .setLabel("When would you like to be reminded")
           .setPlaceholder('e.g. 1 hour, 30 minutes, 2 days')
           .setStyle(TextInputStyle.Short)
           .setRequired(true);


       // Create action rows with inputs
       const contentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
       const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);


       // Add action rows to the modal
       modal.addComponents(contentRow, durationRow);


       // Show the modal
       await buttonInteraction.showModal(modal);


       // Wait for modal submission
       try {
           const modalInteraction = await buttonInteraction.awaitModalSubmit({
               time: 120000, // 2 minutes
               filter: (i: ModalSubmitInteraction) =>
                   i.customId === 'reminder_modal' &&
                   i.user.id === buttonInteraction.user.id
           });


           // Process modal submission
           const content = modalInteraction.fields.getTextInputValue('content');
           const rawDuration = modalInteraction.fields.getTextInputValue('duration');
           const duration = parse(rawDuration);


           if (!duration) {
               return modalInteraction.reply({
                   content: `**${rawDuration}** is not a valid duration. You can use words like hours, minutes, seconds, days, weeks, months, or years.`,
                   ephemeral: true
               });
           }


           // Calculate the expiry date
           const expiryDate = new Date(duration + Date.now());


           // Create and store the reminder directly
           const reminder: Reminder = {
               owner: modalInteraction.user.id,
               content,
               mode: 'public', // could be changed to private if needed
               expires: expiryDate,
               repeat: null // No repeat by default
           };


           await modalInteraction.client.mongo
               .collection(DB.REMINDERS)
               .insertOne(reminder);


           await modalInteraction.reply({
               content: `I'll remind you about that at ${reminderTime(reminder)}.`,
               ephemeral: true
           });


       } catch (error) {
           console.error('Error in modal submission:', error);
           await buttonInteraction.followUp({
               content: 'Reminder creation timed out or failed.',
               ephemeral: true
           });
       }
   }


   // Handle creating a job reminder using a modal
   private async handleCreateJobReminder(buttonInteraction: any) {
       // Check for existing job reminder
       if (await checkJobReminder(buttonInteraction)) {
           return buttonInteraction.reply({
               content:
                   'You currently already have a job reminder set. To clear your existing job reminder, run `/cancelreminder` and provide the reminder number.',
               ephemeral: true
           });
       }


       // Create modal for job reminder settings
       const modal = new ModalBuilder()
           .setCustomId('job_reminder_modal')
           .setTitle('Create Job Reminder');


       // Add inputs for repeat frequency and filter type
       const repeatInput = new TextInputBuilder()
           .setCustomId('repeat')
           .setLabel('Repeat frequency (daily or weekly)')
           .setPlaceholder('Type "daily" or "weekly"')
           .setStyle(TextInputStyle.Short)
           .setRequired(true);


       const filterInput = new TextInputBuilder()
           .setCustomId('filter')
           .setLabel('Filter by (default, relevance, salary, date)')
           .setPlaceholder('Type one of the options')
           .setStyle(TextInputStyle.Short)
           .setRequired(true)
           .setValue('default'); // Default value


       // Create action rows with inputs
       const repeatRow = new ActionRowBuilder<TextInputBuilder>().addComponents(repeatInput);
       const filterRow = new ActionRowBuilder<TextInputBuilder>().addComponents(filterInput);


       // Add action rows to the modal
       modal.addComponents(repeatRow, filterRow);


       // Show the modal
       await buttonInteraction.showModal(modal);


       // Wait for modal submission
       try {
           const modalInteraction = await buttonInteraction.awaitModalSubmit({
               time: 120000, // 2 minutes
               filter: (i: ModalSubmitInteraction) =>
                   i.customId === 'job_reminder_modal' &&
                   i.user.id === buttonInteraction.user.id
           });


           // Process modal submission
           let repeatValue = modalInteraction.fields.getTextInputValue('repeat').toLowerCase();
           let filterValue = modalInteraction.fields.getTextInputValue('filter').toLowerCase();
          
           // Validate repeat input
           if (repeatValue !== 'daily' && repeatValue !== 'weekly' && repeatValue !== 'monthly') {
               return modalInteraction.reply({
                   content: `**${repeatValue}** is not a valid repeat option. Please use "daily" or "weekly".`,
                   ephemeral: true
               });
           }
          
           // Validate filter input
           const validFilters = ['default', 'relevance', 'salary', 'date'];
           if (!validFilters.includes(filterValue)) {
               filterValue = 'default'; // Fallback to default if invalid
           }
          
           // Create and store the job reminder
           const jobReminder: Reminder = {
               owner: modalInteraction.user.id,
               content: 'Job Reminder',
               mode: 'private',
               expires: new Date(), // Set to now, will be handled by the job scheduler
               repeat: repeatValue as 'daily' | 'weekly',
               filterBy: filterValue as 'default' | 'relevance' | 'salary' | 'date'
           };


           await modalInteraction.client.mongo
               .collection(DB.REMINDERS)
               .insertOne(jobReminder);


           await modalInteraction.reply({
               content: `I'll remind you about job offers ${repeatValue} at ${reminderTime(jobReminder)}, filtered by ${filterValue}.`,
               ephemeral: true
           });


       } catch (error) {
           console.error('Error in modal submission:', error);
           await buttonInteraction.followUp({
               content: 'Job reminder creation timed out or failed.',
               ephemeral: true
           });
       }
   }
}

