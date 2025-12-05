import React, { useState } from 'react';
import { ClipboardDocumentIcon } from '../icons';

interface CopyToClipboardButtonProps {
    textToCopy: string | string[];
    className?: string;
}

const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({ textToCopy, className }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const text = Array.isArray(textToCopy) ? textToCopy.join('\n') : textToCopy;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={`p-1.5 text-slate-400 hover:text-violet-400 transition-colors ${className}`}
            title="Copy to clipboard"
        >
            {copied ? <span className="text-xs text-emerald-400">Copied!</span> : <ClipboardDocumentIcon className="w-5 h-5" />}
        </button>
    );
};

export default CopyToClipboardButton;