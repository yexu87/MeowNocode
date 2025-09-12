import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Header from '@/components/Header';
import MemoInput from '@/components/MemoInput';
import MemoList from '@/components/MemoList';
import { useTheme } from '@/context/ThemeContext';

const MainContent = ({
  // Layout state
  isLeftSidebarHidden,
  isRightSidebarHidden,
  setIsLeftSidebarHidden,
  setIsRightSidebarHidden,
  isLeftSidebarPinned,
  isRightSidebarPinned,
  
  // Data
  searchQuery,
  setSearchQuery,
  newMemo,
  setNewMemo,
  filteredMemos,
  pinnedMemos,
  activeMenuId,
  editingId,
  editContent,
  activeTag,
  activeDate, // 新增日期筛选状态
  showScrollToTop,
  
  // Refs
  searchInputRef,
  memosContainerRef,
  menuRefs,
  
  // Callbacks
  onMobileMenuOpen,
  onAddMemo,
  onMenuAction,
  onMenuContainerEnter,
  onMenuContainerLeave,
  onMenuButtonClick,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onTagClick,
  onScrollToTop,
  clearFilters, // 新增清除筛选函数
  onEditorFocus,
  onEditorBlur,
  onOpenMusic,
  onOpenMusicSearch,
  musicEnabled = true,
  // backlinks
  allMemos,
  onAddBacklink,
  onPreviewMemo,
  pendingNewBacklinks
  , onRemoveBacklink,
  // audio
  onAddAudioClip,
  pendingNewAudioClips,
  onRemoveAudioClip
}) => {
  const { themeColor } = useTheme();

  return (
    <div className={`flex-1 flex flex-col w-full relative h-full lg:h-full ${
      isLeftSidebarPinned && isRightSidebarPinned
        ? 'lg:max-w-2xl lg:mx-auto'
        : isLeftSidebarPinned || isRightSidebarPinned
          ? 'lg:max-w-3xl lg:mx-auto'
          : 'lg:max-w-4xl lg:mx-auto px-4'
    }`}>


      {/* 顶部栏 */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
  onMobileMenuOpen={onMobileMenuOpen}
  onOpenMusicSearch={onOpenMusicSearch}
      />

      {/* 编辑区域 */}
      <MemoInput
        newMemo={newMemo}
        setNewMemo={setNewMemo}
        onAddMemo={onAddMemo}
        onEditorFocus={onEditorFocus}
        onEditorBlur={onEditorBlur}
  // backlinks for input editor (new memo has no id; only provide memos list)
  allMemos={allMemos}
  onAddBacklink={onAddBacklink}
  onPreviewMemo={onPreviewMemo}
  pendingNewBacklinks={pendingNewBacklinks}
  onRemoveBacklink={onRemoveBacklink}
  onAddAudioClip={onAddAudioClip}
  audioClips={pendingNewAudioClips}
  onRemoveAudioClip={onRemoveAudioClip}
      />

      {/* Memos列表 */}
      <MemoList
        memos={filteredMemos}
        pinnedMemos={pinnedMemos}
        activeMenuId={activeMenuId}
        editingId={editingId}
        editContent={editContent}
        activeTag={activeTag}
        activeDate={activeDate} // 传递日期筛选状态
        showScrollToTop={showScrollToTop}
        menuRefs={menuRefs}
        memosContainerRef={memosContainerRef}
        onMenuAction={onMenuAction}
        onMenuContainerEnter={onMenuContainerEnter}
        onMenuContainerLeave={onMenuContainerLeave}
        onMenuButtonClick={onMenuButtonClick}
        onEditContentChange={onEditContentChange}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onTagClick={onTagClick}
        onScrollToTop={onScrollToTop}
        clearFilters={clearFilters} // 传递清除筛选函数
  // backlinks for memo cards
  allMemos={allMemos}
  onAddBacklink={onAddBacklink}
  onPreviewMemo={onPreviewMemo}
  onRemoveBacklink={onRemoveBacklink}
  onAddAudioClip={onAddAudioClip}
  onRemoveAudioClip={onRemoveAudioClip}
      />
    </div>
  );
};

export default MainContent;
