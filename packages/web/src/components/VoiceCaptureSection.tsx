import { EncodePanel } from './EncodePanel.js';
import { DecodePanel } from './DecodePanel.js';

interface Props {
    mode: 'encode' | 'decode';
}

export const VoiceCaptureSection = ({ mode }: Props): JSX.Element => {
    return (
        <div className="flex-1 flex flex-col p-4 bg-neutral-950 overflow-y-auto">
            {mode === 'encode' ? <EncodePanel /> : <DecodePanel />}
        </div>
    );
};
