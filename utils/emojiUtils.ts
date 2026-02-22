export const formatCategoryName = (emoji: string, name: string): string => {
    const cleanEmoji = emoji?.trim() || '';
    const cleanName = name?.trim() || '';
    if (!cleanEmoji) return cleanName;
    return `${cleanEmoji} ${cleanName}`;
};

export const parseCategoryName = (fullName: string): { emoji: string, name: string } => {
    if (!fullName) return { emoji: '', name: '' };
    
    // Regex to match starting emoji (simple approximation for common emojis)
    // \p{Extended_Pictographic} covers most emojis.
    // We assume the format is "EMOJI Name" (space separated)
    const match = fullName.match(/^(\p{Extended_Pictographic}+)\s+(.*)$/u);
    
    if (match) {
        return { emoji: match[1], name: match[2] };
    }
    
    // Fallback: Check if the first character is non-ascii or looks like an emoji? 
    // Or just return no emoji if no space pattern found.
    return { emoji: '', name: fullName };
};
