// Menu handling functionality for the reminder system
import { 
    ChatInputCommandInteraction, 
    ButtonInteraction, 
    ComponentType,
    EmbedBuilder
} from "discord.js";
import { COLORS, EMOJI } from "./constants";
import { 
    createMainMenuEmbed, 
    createMainMenuButtons, 
    createBackButton,
    createCancelReminderModal
} from "./ui";
import { handleCreateReminder, completeReminderCreation } from "./reminder-handlers";
import { handleCreateJobReminder } from "./job-handlers";
import { DB } from "@root/config";
import { Reminder } from "@lib/types/Reminder";
import { createErrorEmbed, getReminderIcon } from "./utils";
import { reminderTime } from "@root/src/lib/utils/generalUtils";
// Import the email handlers
import { showEmailModal, showJobEmailModal } from "./email-handlers";

/**
 * Display the main menu for the reminder system
 */
export async function showMainMenu(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    // Create a stylish initial embed
    const embed = createMainMenuEmbed(
        interaction.user.username,
        interaction.user.displayAvatarURL()
    );

    // Create buttons with emojis and clear labels
    const row = createMainMenuButtons();

    // Check if this is the initial interaction or a follow-up
    if (interaction instanceof ChatInputCommandInteraction) {
        // Initial command interaction
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        // Create collector for button interactions
        createButtonCollector(response);
    } else {
        // A button interaction (going back to main menu)
        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    }
}

/**
 * Create a button collector for the main menu
 */
export function createButtonCollector(response: any): void {
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 minute timeout (extended)
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
        // Handle button clicks
        switch (buttonInteraction.customId) {
            case 'create_reminder':
                await handleCreateReminder(buttonInteraction);
                break;
            case 'create_job_reminder':
                await handleCreateJobReminder(buttonInteraction);
                break;
            case 'view_reminders':
                await handleViewReminders(buttonInteraction);
                break;
            case 'cancel_reminder':
                await handleCancelReminder(buttonInteraction);
                break;
            case 'back_to_menu':
                // Handle going back to the main menu
                await showMainMenu(buttonInteraction);
                break;
            case 'email_yes':
                // Actually call the showEmailModal function when the email_yes button is clicked
                await showEmailModal(buttonInteraction);
                break;
            case 'job_email_yes':
                // Call the job email modal function when the job_email_yes button is clicked
                await showJobEmailModal(buttonInteraction);
                break;
            case 'email_no':
                // Handle no for email notification - retrieve the reminder data
                const reminderData = buttonInteraction.client.reminderTemp;
                if (reminderData) {
                    await handleEmailNoForReminder(buttonInteraction);
                } else {
                    const errorEmbed = createErrorEmbed(
                        "Error Processing Reminder",
                        "Something went wrong while processing your reminder. Please try creating it again."
                    );
                        
                    await buttonInteraction.update({
                        embeds: [errorEmbed],
                        components: [createBackButton()]
                    });
                }
                break;
            case 'job_email_no':
                // Handle no for job email notification
                await completeReminderCreation(buttonInteraction, false, null);
                break;
        }
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            const timeoutEmbed = createErrorEmbed(
                "Reminder Action Timed Out",
                "You can run the command again to set up a reminder."
            );
                
            await response.interaction.editReply({
                embeds: [timeoutEmbed],
                components: []
            });
        }
    });
}

/**
 * Handle the view reminders button
 */
export async function handleViewReminders(buttonInteraction: ButtonInteraction): Promise<void> {
    const reminders: Array<Reminder> = await buttonInteraction.client.mongo
        .collection(DB.REMINDERS)
        .find({ owner: buttonInteraction.user.id })
        .toArray();
    
    if (reminders.length < 1) {
        const noRemindersEmbed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`${EMOJI.VIEW} No Reminders Found`)
            .setDescription('You don\'t have any pending reminders!')
            .setFooter({ text: 'Use the CREATE REMINDER button to set one up' })
            .setTimestamp();
            
        // Update instead of reply to replace the message
        buttonInteraction.update({
            embeds: [noRemindersEmbed],
            components: [createBackButton()], // Add back button
        });
        return;
    }
    
    // Split reminders into job reminders and regular reminders
    const jobReminders = reminders.filter(r => r.content === 'Job Reminder');
    const normalReminders = reminders.filter(r => r.content !== 'Job Reminder');
    
    // Sort job reminders by filter priority
    const priorityOrder = { salary: 1, date: 2, relevance: 3, default: 4 };
    jobReminders.sort((a, b) => {
        // Use default for undefined filter values
        const filterA = a.filterBy || 'default';
        const filterB = b.filterBy || 'default';
        
        const aVal = priorityOrder[filterA] || 4; // Default to lowest priority if unknown
        const bVal = priorityOrder[filterB] || 4;
        return aVal - bVal;
    });
    
    // Sort regular reminders by expiration date
    normalReminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());
    
    // Combine the sorted lists with job reminders first
    const sortedReminders = [...jobReminders, ...normalReminders];
    
    const embeds: Array<EmbedBuilder> = [];
    sortedReminders.forEach((reminder, i) => {
        if (i % 10 === 0) { // Reduced to 10 reminders per embed for better readability
            embeds.push(
                new EmbedBuilder()
                    .setTitle(`${EMOJI.VIEW} Your Reminders (${sortedReminders.length})`)
                    .setColor(COLORS.INFO)
                    .setDescription('Here are all your pending reminders:')
                    .setFooter({ 
                        text: `Page ${Math.floor(i / 10) + 1}/${Math.ceil(sortedReminders.length / 10)}` 
                    })
                    .setTimestamp()
            );
        }
        
        const hidden = reminder.mode === 'private';
        const isJobReminder = reminder.content === 'Job Reminder';
        const icon = getReminderIcon(reminder);
        
        // Make sure the filter is displayed correctly
        const filterDisplay = reminder.filterBy || 'default';
        
        // Create the field name with repeat indicator when applicable
        const repeatInfo = reminder.repeat ? ` (${EMOJI.REPEAT} ${reminder.repeat})` : '';
        
        embeds[Math.floor(i / 10)].addFields({
            name: `${i + 1}. ${icon} ${
                hidden
                    ? isJobReminder
                        ? `Job Alert (${filterDisplay})${repeatInfo}`
                        : `Private Reminder${repeatInfo}`
                    : `${reminder.content}${repeatInfo}`
            }`,
            value: hidden
                ? `${EMOJI.REPEAT} **${reminder.repeat}** job reminder filtered by **${filterDisplay}**${
                    reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
                }`
                : `${EMOJI.TIME} Due: **${reminderTime(reminder)}**${
                    reminder.repeat ? `\n${EMOJI.REPEAT} Repeats: **${reminder.repeat}**` : ''
                }${
                    reminder.emailNotification ? `\n${EMOJI.EMAIL} Email notifications to: ${reminder.emailAddress}` : ''
                }`
        });
    });
    
    // Add sorting explanation at the top of the first embed
    if (embeds.length > 0 && jobReminders.length > 0) {
        embeds[0].setDescription('Your reminders are listed below. Job reminders are sorted based on filter priority.');
    }
    
    // Add sorting logic at the bottom of the last embed
    if (embeds.length > 0) {
        embeds[embeds.length - 1].addFields({
            name: '\u200B',
            value: '**Job Reminder Sorting:** salary > date > relevance > default\n' +
                   `Use the ${EMOJI.REPEAT} icon to see which reminders are set to repeat.`
        });
    }
    
    // Add back button to the response
    const backButton = createBackButton();
    
    // Update instead of reply to replace the message
    await buttonInteraction.update({ 
        embeds,
        components: [backButton], // Add back button
    });
}
/**
 * Handle the cancel reminder button
 */
export async function handleCancelReminder(buttonInteraction: ButtonInteraction): Promise<void> {
    // Create modal for reminder cancellation
    const modal = createCancelReminderModal();

    // Show the modal
    await buttonInteraction.showModal(modal);

    // Wait for modal submission
    try {
        const modalInteraction = await buttonInteraction.awaitModalSubmit({
            time: 60000, // 1 minute
            filter: (i) =>
                i.customId === 'cancel_reminder_modal' &&
                i.user.id === buttonInteraction.user.id
        });

        // Process modal submission
        const reminderNumStr = modalInteraction.fields.getTextInputValue('reminder_number');
        const reminderNum = parseInt(reminderNumStr) - 1; // Convert to 0-based index
        
        if (isNaN(reminderNum) || reminderNum < 0) {
            const errorEmbed = createErrorEmbed(
                "Invalid Reminder Number",
                `**"${reminderNumStr}"** is not a valid reminder number. Please enter a positive integer.`
            ).setFooter({ text: 'Use the VIEW REMINDERS button to see your reminders and their numbers' });
               
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
                embeds: [errorEmbed],
                components: [createBackButton()], // Add back button
            });
            
            return;
        }

        // Get user's reminders and sort them THE SAME WAY as in handleViewReminders
        const reminders: Array<Reminder> = await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .find({ owner: modalInteraction.user.id })
            .toArray();
        
        // Split reminders into job reminders and regular reminders
        const jobReminders = reminders.filter(r => r.content === 'Job Reminder');
        const normalReminders = reminders.filter(r => r.content !== 'Job Reminder');
        
        // Sort job reminders by filter priority
        const priorityOrder = { salary: 1, date: 2, relevance: 3, default: 4 };
        jobReminders.sort((a, b) => {
            // Use default for undefined filter values
            const filterA = a.filterBy || 'default';
            const filterB = b.filterBy || 'default';
            
            const aVal = priorityOrder[filterA] || 4; // Default to lowest priority if unknown
            const bVal = priorityOrder[filterB] || 4;
            return aVal - bVal;
        });
        
        // Sort regular reminders by expiration date
        normalReminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());
        
        // Combine the sorted lists with job reminders first - THIS MUST MATCH handleViewReminders exactly
        const sortedReminders = [...jobReminders, ...normalReminders];
        
        // Check if the reminder exists in the SORTED list
        const reminder = sortedReminders[reminderNum];
        if (!reminder) {
            const notFoundEmbed = createErrorEmbed(
                "Reminder Not Found",
                `I couldn't find reminder **#${reminderNum + 1}**. Please check the number and try again.`
            ).setFooter({ text: 'Use the VIEW REMINDERS button to see your current reminders' });
            
            // Defer the modal reply to acknowledge it without sending a visible message
            await modalInteraction.deferUpdate();
            
            // Update the original message with the error
            await buttonInteraction.editReply({
                embeds: [notFoundEmbed],
                components: [createBackButton()], // Add back button
            });
            
            return;
        }

        // Create a query to exactly match this reminder
        const reminderQuery = {
            owner: reminder.owner,
            content: reminder.content,
            expires: reminder.expires
        };
        
        // If it's a job reminder, include the filter type in the query
        if (reminder.content === 'Job Reminder' && reminder.filterBy) {
            reminderQuery['filterBy'] = reminder.filterBy;
        }
        
        // Delete the reminder
        const deleteResult = await modalInteraction.client.mongo
            .collection(DB.REMINDERS)
            .deleteOne(reminderQuery);

        // Make sure we deleted something
        if (deleteResult.deletedCount === 0) {
            const errorEmbed = createErrorEmbed(
                "Deletion Failed",
                `There was a problem deleting reminder **#${reminderNum + 1}**. Please try again or check if it has already been deleted.`
            );
            
            await modalInteraction.deferUpdate();
            await buttonInteraction.editReply({
                embeds: [errorEmbed],
                components: [createBackButton()]
            });
            return;
        }

        // Create success message
        const hidden = reminder.mode === 'private';
        const isJobReminder = reminder.content === 'Job Reminder';
        const filterDisplay = reminder.filterBy || 'default';
        const emailInfo = reminder.emailNotification ? `\nEmail notifications to ${reminder.emailAddress} have been canceled.` : '';
        
        const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(`${EMOJI.CANCEL} Reminder Cancelled`)
            .setDescription(
                `Successfully cancelled reminder **#${reminderNum + 1}**: ${
                    hidden 
                        ? (isJobReminder ? `Job Alert (${filterDisplay})` : 'Private Reminder') 
                        : `"${reminder.content}"`
                }${emailInfo}`
            )
            .setTimestamp();
            
        // Defer the modal reply to acknowledge it without sending a visible message
        await modalInteraction.deferUpdate();
            
        // Update the original message with the success info
        await buttonInteraction.editReply({
            embeds: [successEmbed],
            components: [createBackButton()], // Add back button
        });

    } catch (error) {
        console.error('Error in modal submission:', error);
        
        const errorEmbed = createErrorEmbed(
            "Cancellation Failed",
            "The reminder cancellation process timed out or an error occurred."
        );
            
        // Update the original button interaction
        await buttonInteraction.editReply({
            embeds: [errorEmbed],
            components: [createBackButton()], // Add back button
        });
    }
}

/**
 * Handle the email no button for standard reminders
 */
export async function handleEmailNoForReminder(buttonInteraction: ButtonInteraction): Promise<void> {
    // Get the reminder data from client storage
    const reminderData = buttonInteraction.client.reminderTemp;
    
    if (reminderData) {
        // Finalize without email
        await completeReminderCreation(buttonInteraction, false, null);
    } else {
        const errorEmbed = createErrorEmbed(
            "Error Processing Reminder",
            "Something went wrong while processing your reminder. Please try creating it again."
        );
            
        await buttonInteraction.update({
            embeds: [errorEmbed],
            components: [createBackButton()]
        });
    }
}