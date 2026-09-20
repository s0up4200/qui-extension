import type { AssembleResult, CrossSeedProposals } from '@/lib/api';

export interface TargetRow {
  /** Lowercased, so a selection and a row always agree. */
  hash: string;
  name: string;
  detail: string;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Several targets can be selected: the upload is a season pack and the instance can link files. */
export function canAssemble(match: CrossSeedProposals): boolean {
  return match.pack_mode && !match.assembly_unavailable_reason;
}

/** Picker rows: ranked proposals first, then suggested targets the ranking did not surface. */
export function targetRows(match: CrossSeedProposals, suggest: AssembleResult | null): TargetRow[] {
  const rows: TargetRow[] = match.proposals.map((p) => ({
    hash: p.hash.toLowerCase(),
    name: p.name,
    detail: `${Math.round(p.overlap_fraction * 100)}% overlap · ${formatBytes(p.size)}${p.category ? ` · ${p.category}` : ''}`,
  }));
  for (const target of suggest?.targets ?? []) {
    const hash = target.hash.toLowerCase();
    if (!rows.some((row) => row.hash === hash)) {
      rows.push({ hash, name: target.name, detail: 'suggested episode' });
    }
  }
  return rows;
}

/**
 * Initial selection. A pack preselects every suggested target that qui did not
 * reject; anything else takes the top proposal.
 */
export function defaultTargets(match: CrossSeedProposals, suggest: AssembleResult | null): string[] {
  if (canAssemble(match) && suggest) {
    return suggest.targets.filter((t) => !t.reason).map((t) => t.hash.toLowerCase());
  }
  const top = match.proposals[0];
  return top ? [top.hash.toLowerCase()] : [];
}

/** Human text for a qui assembly reason code. Mirrors qui's manualCrossSeed.pack.reasons. */
export function assembleReason(reason: string): string {
  return ASSEMBLE_REASONS[reason] ?? `Could not check this selection (${reason}).`;
}

const ASSEMBLE_REASONS: Record<string, string> = {
  no_filesystem_access: 'This instance needs local filesystem access to assemble a pack.',
  no_link_mode: 'Enable hardlink or reflink mode on this instance to select several targets.',
  no_base_directory: 'Configure a link base directory on this instance.',
  no_episode_files: 'No playable episode files were found in this pack.',
  target_not_found: 'Target not found in this instance.',
  incomplete: 'Target download is incomplete.',
  no_episode_identity: 'The episode number could not be parsed.',
  file_list_unavailable: 'The target file list is unavailable.',
  episode_file_invalid: 'The target must contain one playable file with the selected episode identity.',
  size_mismatch: 'The local file size differs from the pack file size.',
  release_mismatch: 'The release does not match the pack.',
  local_file_unavailable: 'The local file is missing or unavailable.',
  not_paired: 'This target did not provide a pack episode, or another selected target already covers it.',
  layout_mismatch: 'The selected files cannot form a safe link tree.',
  unsafe_piece_boundary: 'Piece boundary protection blocked this pack because selected and missing files share a data block. Downloading that block can change your original files through hardlinks.',
  already_exists: 'This torrent already exists.',
  link_failed: 'Failed to create the links.',
  add_failed: 'Failed to add the torrent.',
};
