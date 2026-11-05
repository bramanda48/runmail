import type { Mailbox } from "@runmail/shared";

export interface MailboxTeamSection {
  team_id: string;
  name: string;
  mailboxes: Mailbox[];
}

export interface MailboxGroups {
  directMailboxes: Mailbox[];
  teamSections: MailboxTeamSection[];
}

/**
 * Split one page of mailboxes into direct-access mailboxes and
 * one section per team granting access. A mailbox shared via two
 * teams appears under both sections.
 */
export function groupMailboxesByTeam(mailboxes: Mailbox[]): MailboxGroups {
  const directMailboxes = mailboxes.filter(
    (mailbox) => !mailbox.via_teams || mailbox.via_teams.length === 0,
  );

  const map = new Map<string, MailboxTeamSection>();
  for (const mailbox of mailboxes) {
    for (const team of mailbox.via_teams ?? []) {
      const section = map.get(team.team_id) ?? {
        team_id: team.team_id,
        name: team.name,
        mailboxes: [],
      };
      section.mailboxes.push(mailbox);
      map.set(team.team_id, section);
    }
  }
  return { directMailboxes, teamSections: [...map.values()] };
}
