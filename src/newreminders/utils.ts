// Utility functions for the reminders system
import { COLORS, EMOJI } from "./constants";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ButtonInteraction } from "discord.js";
import { Reminder } from "@lib/types/Reminder";

/**
 * Validates an email address format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Creates an error embed with the specified message
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(COLORS.DANGER)
        .setTitle(`${EMOJI.CANCEL} ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Creates a success embed for a standard reminder
 */
export function createReminderSuccessEmbed(
    content: string, 
    expiryTime: string, 
    withEmail: boolean = false, 
    email: string = null
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.REMINDER} Reminder Set!`)
        .setDescription(`I'll remind you about that at **${expiryTime}**.`)
        .addFields({ 
            name: 'Reminder Content', 
            value: `> ${content}` 
        });
        
    // Add email info if applicable
    if (withEmail && email) {
        embed.addFields({
            name: 'Email Notification',
            value: `You'll also receive an email at **${email}** when this reminder triggers.`
        });
    }
    
    embed.setTimestamp();
    
    return embed;
}

/**
 * Creates a success embed for a job reminder
 */
export function createJobReminderSuccessEmbed(
    repeatValue: string, 
    filterValue: string, 
    expiryTime: string,
    withEmail: boolean = false, 
    email: string = null
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SECONDARY)
        .setTitle(`${EMOJI.JOB} Job Alert Created`)
        .setDescription(
            `I'll send you job opportunities **${repeatValue}** starting at **${expiryTime}**.`
        )
        .addFields(
            { name: 'Frequency', value: `${repeatValue.charAt(0).toUpperCase() + repeatValue.slice(1)}`, inline: true },
            { name: 'Sorted By', value: `${filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}`, inline: true }
        );
        
    // Add email info if applicable
    if (withEmail && email) {
        embed.addFields({
            name: 'Email Notification',
            value: `You'll also receive job alerts at **${email}** when they trigger.`
        });
    }
    
    embed.setFooter({ text: 'You can update your preferences anytime' })
         .setTimestamp();
         
    return embed;
}

/**
 * Format reminder icon based on type
 */
export function getReminderIcon(reminder: Reminder): string {
    const isJobReminder = reminder.content === 'Job Reminder';
    const emailIcon = reminder.emailNotification ? ` ${EMOJI.EMAIL}` : '';
    
    return `${isJobReminder ? EMOJI.JOB : EMOJI.REMINDER}${emailIcon}`;
}

/**
 * Helper for checking job reminder that accepts ButtonInteraction
 * This wraps the original checkJobReminder function to handle ButtonInteraction
 */
export async function checkJobReminderForButton(buttonInteraction: ButtonInteraction): Promise<boolean> {
    const DB = (await import('@root/config')).DB;
    const reminders = await buttonInteraction.client.mongo
        .collection(DB.REMINDERS)
        .find({ owner: buttonInteraction.user.id })
        .toArray();

    return reminders.some(
        (reminder) => reminder.content === 'Job Reminder'
    );
}