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

import { ButtonInteraction, CommandInteraction, GuildMember, MessageActionRow, MessageButton, MessageEmbed, MessagePayload, MessageSelectMenu, MessageSelectOptionData, SelectMenuInteraction, WebhookEditMessageOptions } from 'discord.js';
import { decode } from 'html-entities';
import { ANLiveAPI, DiffusionData, EditoData, LiveData } from '../api/ANLiveAPI';
import { Command } from '../base/Command';
import { Bot } from '../Bot';
import { Audio } from '../utils/Audio';
import { Emoji } from '../utils/Emoji';
import { I18n } from '../utils/I18n';

export class LiveCommand extends Command {
    constructor() {
        super();
        Bot.registerSelect("live_seance", this.selectSeance.bind(this));
        Bot.registerButton("live_listen", this.listenSeance.bind(this));
        Bot.registerButton("live_reload", this.reloadSeance.bind(this));
    }

    getName() {
        return "live";
    }

    private getSelectable(live: LiveData, edito: EditoData): MessageSelectOptionData[] | undefined {
        if (edito.diffusion === undefined)
            return undefined;

        const out = [];

        for (const l of live) {
            const e: DiffusionData | undefined = edito.diffusion.find(v => v.flux + "" === l.flux);
            if (e?.flux + "" === "")
                continue;
            if (e !== undefined) {
                out.push({
                    label: e.libelle_court, value: l.flux
                });
            }
        }

        if (out.length === 0)
            return undefined;

        return out;
    }

    private async getMessageData(selected: string | null = null, locale: string): Promise<MessagePayload | WebhookEditMessageOptions> {
        let live: LiveData, edito: EditoData;
        try {
            live = await ANLiveAPI.live();
            edito = await ANLiveAPI.edito();
        } catch (e: any) {
            return { content: I18n.getI18n('command.live.error', locale) };
        }

        const selectable = this.getSelectable(live, edito);

        if (selectable === undefined || live.length === 0) {
            const embed = new MessageEmbed();
            embed.setTitle(I18n.getI18n('command.live.embed.title', locale));
            embed.setDescription(I18n.getI18n('command.live.embed.nolive', locale));
            return {
                embeds: [embed], components: [new MessageActionRow().addComponents(
                    new MessageSelectMenu().setCustomId("live_seance")
                        .setPlaceholder(I18n.getI18n('command.live.embed.session', locale))
                        .addOptions(selectable ?? [{ label: "ERROR", value: "ERROR" }])
                        .setDisabled(true)
                ), new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("live_listen,null")
                        .setLabel(I18n.getI18n('command.live.embed.listen', locale))
                        .setStyle("PRIMARY")
                        .setDisabled(true),
                    new MessageButton()
                        .setURL(`https://videos.assemblee-nationale.fr/direct`)
                        .setLabel(I18n.getI18n('command.live.embed.watch', locale))
                        .setStyle("LINK")
                        .setDisabled(true)
                ).addComponents(
                    new MessageButton().setCustomId("live_reload,null")
                        .setLabel(I18n.getI18n('command.live.embed.refresh', locale))
                        .setStyle("SECONDARY")
                        .setEmoji(Emoji.refresh)
                )]
            };
        } else {
            const embed = new MessageEmbed();

            if (selected === null || selected === "null") {
                embed.setTitle(I18n.getI18n('command.live.embed.title', locale));
                embed.setDescription(I18n.getI18n('command.live.embed.select', locale));
            } else {
                const diffusions = edito.diffusion.filter(v => v.flux + "" === selected);
                if (diffusions.length === 0) {
                    embed.setTitle("Live Assemblée Nationale");
                    embed.setDescription(I18n.getI18n('command.live.embed.select', locale));
                } else {
                    let diffusion: DiffusionData | undefined = undefined;
                    if (diffusions.length === 1) {
                        diffusion = diffusions[0];
                    } else {
                        diffusions.sort((a, b) => a.heure - b.heure);

                        const currentDate = new Date();
                        currentDate.setMinutes(currentDate.getMinutes());
                        let hour = currentDate.getHours() * 100 + currentDate.getMinutes();
                        if (hour < 600)
                            hour += 2400;

                        for (let i = 0; i < diffusions.length - 1; i++) {
                            if (hour < diffusions[i + 1].heure) {
                                diffusion = diffusions[i];
                                break;
                            }
                        }
                        if (diffusion === undefined) {
                            diffusion = diffusions[diffusions.length - 1];
                        }
                    }

                    embed.setTitle(diffusion.libelle === "" ? diffusion.libelle_court : diffusion.libelle);
                    embed.setDescription(decode(diffusion.sujet).replace("<br>", "\n").replace("<br/>", "\n"));
                    embed.setThumbnail(`https://videos.assemblee-nationale.fr/live/images/${diffusion.id_organe}.jpg`);
                }
            }

            return {
                embeds: [embed], components: [new MessageActionRow().addComponents(
                    new MessageSelectMenu().setCustomId("live_seance")
                        .setPlaceholder(I18n.getI18n('command.live.embed.session', locale))
                        .addOptions(selectable ?? [{ label: "ERROR", value: "ERROR" }])
                ), new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("live_listen," + selected)
                        .setLabel(I18n.getI18n('command.live.embed.listen', locale))
                        .setStyle("PRIMARY")
                        .setDisabled(selected === null),
                    new MessageButton()
                        .setURL(`https://videos.assemblee-nationale.fr/direct.${selected}`)
                        .setLabel(I18n.getI18n('command.live.embed.watch', locale))
                        .setStyle("LINK")
                        .setDisabled(selected === null),
                ).addComponents(
                    new MessageButton().setCustomId("live_reload," + selected)
                        .setLabel(I18n.getI18n('command.live.embed.refresh', locale))
                        .setStyle("SECONDARY")
                        .setEmoji(Emoji.refresh)
                )]
            };
        }

    }

    async listenSeance(interaction: ButtonInteraction) {
        const member: GuildMember | null = interaction.member as GuildMember | null;
        if (member === null)
            return;

        if (member.voice.channelId === null) {
            interaction.reply({ content: I18n.getI18n('command.live.error.voice', interaction.locale), ephemeral: true });
            return;
        }

        const flux = interaction.customId.split(",")[1];

        try {
            const live = await ANLiveAPI.live();
            if (live.find((v) => v.flux === flux) === undefined) {
                interaction.reply({ content: I18n.getI18n('command.live.error.notlive', interaction.locale), ephemeral: true });
                return;
            }
        } catch (e: any) {
            interaction.reply({ content: I18n.getI18n('command.live.error', interaction.locale), ephemeral: true });
            return;
        }

        Audio.playStream(`https://videos.assemblee-nationale.fr/live/live${flux}/playlist${flux}.m3u8`, {
            channelId: member.voice.channelId,
            guildId: member.guild.id,
            adapterCreator: member.guild.voiceAdapterCreator,
        });

        interaction.reply({ content: I18n.getI18n('command.live.joining', interaction.locale), ephemeral: true });
    }

    async selectSeance(interaction: SelectMenuInteraction) {
        await interaction.deferUpdate();
        const select = interaction.values[0];
        interaction.editReply(await this.getMessageData(select, interaction.locale));
    }

    async reloadSeance(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        const flux = interaction.customId.split(",")[1];
        interaction.editReply(await this.getMessageData(flux === "null" ? null : flux, interaction.locale));
    }

    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply(await this.getMessageData(null, interaction.locale));
    }
}
