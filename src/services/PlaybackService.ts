import TrackPlayer, { Event } from "react-native-track-player";
import { HistoryService } from "./HistoryService";

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (e) {
      console.log('Error in RemotePrevious', e);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  
  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      const durationPlayed = event.lastPosition;
      
      // SOLUCIÓN: Usar estrictamente lastTrack. 
      // Si no existe, no intentamos adivinar con la pista actual.
      const previousTrack = event.lastTrack; 

      if (previousTrack && previousTrack.id && durationPlayed) {
        await HistoryService.logToDatabase(
          previousTrack.id.toString(),
          durationPlayed,
          "queue",
        );
      }
    },
  );
};
