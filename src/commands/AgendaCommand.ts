/**
 * Copyright © 2022 Maxime Friess <M4x1me@pm.me>
 * 
 * This file is part of LegiBot.
 * 
 * LegiBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * LegiBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with LegiBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { APIApplicationCommandOption, ApplicationCommandOptionType } from 'discord-api-types/v9';
import { ButtonInteraction, CommandInteraction, MessageActionRow, MessageAttachment, MessageButton } from 'discord.js';
import moment from 'moment';
import { AgendaEntry, AgendaFilter, ANAgendaAPI } from '../api/ANAgendaAPI';
import { Command } from '../base/Command';
import { Bot } from '../Bot';
import { Agenda } from '../utils/Agenda';
import { I18n } from '../utils/I18n';

export class AgendaCommand extends Command {
    constructor() {
        super();
        Bot.registerButton("agenda_button", this.agnedaButton.bind(this));
    }

    getName() {
        return "agenda";
    }

    getOptions(): APIApplicationCommandOption[] {
        return [{
            type: ApplicationCommandOptionType.Subcommand,
            ...I18n.argumentI18n(this, 'day'),
            options: [{
                type: ApplicationCommandOptionType.String,
                ...I18n.argumentI18n(this, 'date'),
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'public'),
                required: false
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'commission'),
                required: false
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'meetings'),
                required: false
            }]
        }, {
            type: ApplicationCommandOptionType.Subcommand,
            ...I18n.argumentI18n(this, 'week'),
            options: [{
                type: ApplicationCommandOptionType.String,
                ...I18n.argumentI18n(this, 'date'),
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'public'),
                required: false
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'commission'),
                required: false
            }, {
                type: ApplicationCommandOptionType.Boolean,
                ...I18n.argumentI18n(this, 'meetings'),
                required: false
            }]
        }]
    }

    private async messageData(date: Date, period: "week" | "day", filter: AgendaFilter, locale: string) {
        let message = '';
        let agenda: AgendaEntry[] = [];
        if (period === 'day') {
            agenda = await ANAgendaAPI.day_agenda(date, filter);
        } else {
            agenda = await ANAgendaAPI.week_agenda(date, filter);
        }

        message += `**${I18n.formatI18n(`command.agenda.reply.${period}.title`, locale, { date: moment(date).format('DD/MM/YYYY') })}**\n\n`;

        let files: MessageAttachment[] = [];

        if (agenda.length === 0) {
            message += `*${I18n.getI18n("command.agenda.reply.noevents", locale)}*`;
        } else {
            files = [new MessageAttachment(await Agenda.renderAgenda(agenda), 'agenda.png')];
        }

        const row = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(`agenda_button,${moment(date).subtract(1, period).format("YYYY-MM-DD")},${period},${filter.commission ? "C" : ""}${filter.meetings ? "M" : ""}${filter.public ? "P" : ""}`)
                .setLabel(I18n.getI18n(`command.agenda.reply.${period}.previous`, locale))
                .setStyle("PRIMARY")
        ).addComponents(
            new MessageButton()
                .setCustomId(`agenda_button,${moment(date).add(1, period).format("YYYY-MM-DD")},${period},${filter.commission ? "C" : ""}${filter.meetings ? "M" : ""}${filter.public ? "P" : ""}`)
                .setLabel(I18n.getI18n(`command.agenda.reply.${period}.next`, locale))
                .setStyle("PRIMARY")
        )

        return { content: message, files, components: [row] };
    }

    async agnedaButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        const [_, d, p, f] = interaction.customId.split(",");
        const date = moment(d, "YYYY-MM-DD").toDate();
        const period = p as "week" | "day";
        const filter: AgendaFilter = {
            commission: f.includes('C'),
            meetings: f.includes('M'),
            public: f.includes('P')
        };

        await interaction.editReply(await this.messageData(date, period, filter, interaction.locale));
    }

    async execute(interaction: CommandInteraction) {
        const date_string = interaction.options.getString('date', false);
        let date = new Date();
        if (date_string !== null) {
            date = moment(date_string, 'DD/MM/YYYY').toDate();
            if (isNaN(date.getTime())) {
                interaction.reply({
                    content: I18n.getI18n("command.agenda.reply.invalid.date", interaction.locale),
                    ephemeral: true
                });
                return;
            }
        }

        const filter: AgendaFilter = {
            commission: interaction.options.getBoolean('commission', false) ?? true,
            public: interaction.options.getBoolean('public', false) ?? true,
            meetings: interaction.options.getBoolean('meetings', false) ?? false
        };

        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply(await this.messageData(date, interaction.options.getSubcommand() as "week" | "day", filter, interaction.locale));
    }
}
