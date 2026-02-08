import { EncodePanel } from './EncodePanel.js';
import { DecodePanel } from './DecodePanel.js';

interface Props {
    mode: 'encode' | 'decode';
}

export const VoiceCaptureSection = ({ mode }: Props): JSX.Element => {
    return (
        <div className="flex-1 flex flex-col bg-neutral-950 overflow-y-auto">
            <div className={`flex-1 p-4 ${mode === 'encode' ? '' : 'hidden'}`}>
                <EncodePanel />
            </div>
            <div className={`flex-1 p-4 ${mode === 'decode' ? '' : 'hidden'}`}>
                <DecodePanel />
            </div>
        </div>
    );
};
