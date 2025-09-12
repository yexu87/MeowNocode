import React from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import MemoEditor from '@/components/MemoEditor';

const MemoInput = ({ newMemo, setNewMemo, onAddMemo, onEditorFocus, onEditorBlur, allMemos = [], onAddBacklink, onPreviewMemo, pendingNewBacklinks = [], onRemoveBacklink, onAddAudioClip, audioClips = [], onRemoveAudioClip }) => {
  return (
    <div className="flex-shrink-0 p-3 sm:p-4 lg:p-6 pb-0">
      <div className="relative">
        <MemoEditor
          value={newMemo}
          onChange={setNewMemo}
          onSubmit={onAddMemo}
          placeholder="现在的想法是……"
          maxLength={5000}
          showCharCount={true}
          autoFocus={false}
          onFocus={onEditorFocus}
          onBlur={onEditorBlur}
          memosList={allMemos}
          currentMemoId={null}
          backlinks={pendingNewBacklinks}
          onAddBacklink={onAddBacklink}
          onPreviewMemo={onPreviewMemo}
          onRemoveBacklink={onRemoveBacklink}
          audioClips={audioClips}
          onRemoveAudioClip={onRemoveAudioClip}
          onAddAudioClip={onAddAudioClip}
        />
        <Button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={onAddMemo}
          disabled={!newMemo.trim()}
          className="absolute bottom-12 right-2 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white shadow-md px-3 py-2 flex items-center transition-colors"
        >
          <Send className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </div>
  );
};

export default MemoInput;
