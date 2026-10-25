import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MobileTabBar } from '/src/components/common/MobileTabBar';
import { Sidebar } from '/src/components/sidebar/Sidebar';
import { LibraryView } from '/src/components/views/LibraryView';
import { SettingsView } from '/src/components/views/SettingsView';
import { MobileNowPlaying } from '/src/components/player/MobileNowPlaying';
import { PlayerBar } from '/src/components/player/PlayerBar';
import { SaveToPlaylistModal } from '/src/components/modals/SaveToPlaylistModal';
import { useClickOutsideMenus } from '/src/hooks/useClickOutsideMenus';
import { defaults } from '/src/domain/types';
import { initializeTheme } from '/src/theme';
import '/src/style.css';
initializeTheme();
const noop=(value)=>{if(value===1||value===-1)window.lastSkip=value;};
const tracks=[1,2,3].map(i=>({id:'t'+i,title:'Song '+i+' with a longer title',artist:'Artist '+i,album:'Album '+i,duration:220,fileName:'song.mp3',format:'MP3',missing:false}));
const seed=defaults();seed.queue=tracks.map((t,i)=>({id:'q'+i,trackId:t.id}));seed.currentId='q0';seed.favorites=tracks.map(t=>t.id);seed.playlists=[{id:'p1',name:'Evening listening',items:tracks.map((t,i)=>({id:'p'+i,trackId:t.id}))}];
seed.favoriteAlbums=[{id:'a1',title:'A saved album',artist:'An artist'}];seed.favoriteArtists=[{id:'a2',name:'A saved artist'}];
function Preview(){
 const [view,setView]=useState('library'),[session,setSession]=useState(seed),[expanded,setExpanded]=useState(false),[queueTab,setQueueTab]=useState(false),[query,setQuery]=useState(''),[tick,setTick]=useState(0),[dialog,setDialog]=useState(false);
 const dialogRef=useRef(null);useClickOutsideMenus();
 useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),300);return()=>clearInterval(id)},[]);
 useEffect(()=>{if(dialog)dialogRef.current?.showModal();else dialogRef.current?.close()},[dialog]);
 const playback={status:'paused',time:20+tick,duration:220};
 const setSetting=(key,value)=>setSession(s=>({...s,settings:{...s.settings,[key]:value}}));
 const rowProps={tracks,visible:tracks,rows:tracks.map(t=>({t,entryId:t.id})),playbackStatus:'paused',session,downloads:{},collections:[{id:'p1',name:'Evening listening',tracks,playlist:session.playlists[0]}],query,busy:false,mobile:true,desktop:true,onSetQuery:setQuery,onSelectView:setView,onPlayAll:noop,onPlayTrackInList:noop,onImportMusic:noop,onFavorite:noop,onRemoveTrack:noop,onDownloadTrack:noop,onDeleteOffline:noop,onQueueTrack:noop,onRelinkTrack:noop,onChoosePlaylist:()=>setDialog(true),onOpenImport:noop,onCreatePlaylist:noop};
 return <div className={'app '+(innerWidth<769?'android':'')}>
 <Sidebar view={view} setView={setView} onHome={()=>setView('home')} collectionsCount={1} playlists={session.playlists} collections={rowProps.collections} hasLyricsDoc={true} onCreatePlaylist={noop} onToggleQueue={()=>{setQueueTab(true);setExpanded(true)}}/>
 <div className="workspace"><main id="main">
 {view==='settings'?<SettingsView session={session} tracks={tracks} downloads={{}} busy={false} mobile={true} ytdlpAvailable={true} engineState="installed" onRefreshYoutubeEngine={async()=>{}} onInstallYoutubeEngine={noop} onCancelYoutubeEngineInstall={noop} onSetting={setSetting} onExportLibrary={noop} onImportBackup={noop} onClearHistory={noop} onClearLyricCache={noop} onCancelDownload={noop} onRetryDownload={noop} onDeleteOffline={noop}/>:<LibraryView {...rowProps} view={view==='p1'?'p1':view} heading={view} playlist={view==='p1'?session.playlists[0]:undefined}/>}
 </main></div>
 {!expanded&&<PlayerBar track={tracks[0]} tracks={tracks} playback={playback} session={session} downloads={{}} busy={false} view={view} setView={setView} mobile={true} onExpand={()=>{setQueueTab(false);setExpanded(true)}} onSeek={s=>window.lastSeek=s} onTogglePlay={noop} onSkip={noop} onFavorite={noop} onChoosePlaylist={()=>setDialog(true)} onDownloadTrack={noop} onDeleteOffline={noop} onSaveOnline={noop} onCancelDownload={noop} onSetting={setSetting}/>}
 {expanded&&<MobileNowPlaying initialTab={queueTab?'queue':'player'} track={tracks[0]} tracks={tracks} playback={playback} session={session} onClose={()=>setExpanded(false)} onTogglePlay={noop} onSkip={noop} onSeek={s=>window.lastSeek=s} onFavorite={noop} onSetting={setSetting} onNavigateArtist={noop} onChoosePlaylist={()=>setDialog(true)} onSelectQueue={noop} onReorderUpcoming={noop} onRemoveQueue={id=>setSession(s=>({...s,queue:s.queue.filter(q=>q.id!==id)}))} onClearQueue={noop} lyrics={<div className="lyric-room"><div className="lyric-lines"><button className="lyric-line is-active"><span className="lyric-primary">A short active line</span><span className="lyric-translation">A translation line</span></button><button className="lyric-line"><span className="lyric-primary">Another readable line</span></button></div></div>}/>}
 <MobileTabBar view={view} setView={setView}/>
 <dialog ref={dialogRef} onCancel={()=>setDialog(false)}><SaveToPlaylistModal playlistTarget={tracks[0]} tracks={tracks} session={session} busy={false} onClose={()=>setDialog(false)} onSave={noop} onRemove={noop}/></dialog>
 </div>
}
createRoot(document.getElementById('root')).render(<Preview/>);

