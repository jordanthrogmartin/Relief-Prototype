export const formatCategoryName = (emoji: string, name: string): string => {
    const cleanEmoji = emoji?.trim() || '';
    const cleanName = name?.trim() || '';
    if (!cleanEmoji) return cleanName;
    return `${cleanEmoji} ${cleanName}`;
};

export const parseCategoryName = (fullName: string): { emoji: string, name: string } => {
    if (!fullName) return { emoji: '', name: '' };
    
    // Improved regex to match starting emoji, including:
    // - Extended Pictographics
    // - Emoji Modifiers (skin tones)
    // - Zero Width Joiner (\u200D)
    // - Variation Selector-16 (\uFE0F)
    // - Keycap combining characters (\u20E3) - added for completeness though less common as "icon"
    const match = fullName.match(/^([\p{Extended_Pictographic}\p{EMod}\u200D\uFE0F\u20E3]+)\s+(.*)$/u);
    
    if (match) {
        return { emoji: match[1], name: match[2] };
    }
    
    return { emoji: '', name: fullName };
};
