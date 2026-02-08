interface Props {
    mode: 'encode' | 'decode';
    onModeChange: (mode: 'encode' | 'decode') => void;
}

export const ModeSelectionSection = ({ mode, onModeChange }: Props): JSX.Element => {
    return (
        <div className="flex gap-2 p-4 bg-neutral-900">
            <button
                onClick={() => onModeChange('encode')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${mode === 'encode'
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                    }`}
            >
                Encode
            </button>
            <button
                onClick={() => onModeChange('decode')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${mode === 'decode'
                        ? 'bg-amber-500 text-white'
                        : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                    }`}
            >
                Decode
            </button>
        </div>
    );
};
