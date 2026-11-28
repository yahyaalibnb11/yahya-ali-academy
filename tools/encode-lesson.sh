#!/bin/bash
# usage: enc.sh <input.mp4> <lesson-slug>
set -e
IN="$1"; S="$2"; O=/home/user/cw/hls/$S; mkdir -p $O/1080 $O/720 $O/480
K=/home/user/cw/keys/$S.key; [ -f $K ] || openssl rand 16 > $K
IV=$(openssl rand -hex 16)
printf "KEYURI\n%s\n%s\n" "$K" "$IV" > /home/user/cw/keys/$S.keyinfo
[ -f $O/done ] && exit 0
ffmpeg -hide_banner -loglevel error -stats -y -i "$IN" -filter_complex \
"[0:v]zscale=w=1920:h=1080:f=bilinear:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=saturation=1.08:contrast=1.03,split=3[a][b][c];[b]scale=1280:720[b2];[c]scale=854:480[c2]" \
-map "[a]" -map 0:a -map "[b2]" -map 0:a -map "[c2]" -map 0:a \
-c:v libx264 -preset veryfast -profile:v high -g 48 -keyint_min 48 -sc_threshold 0 -r 24 \
-b:v:0 2400k -maxrate:v:0 2900k -bufsize:v:0 4800k \
-b:v:1 1300k -maxrate:v:1 1600k -bufsize:v:1 2600k \
-b:v:2 650k -maxrate:v:2 800k -bufsize:v:2 1300k \
-c:a aac -b:a 128k -ac 2 -ar 48000 \
-f hls -hls_time 6 -hls_playlist_type vod -hls_key_info_file /home/user/cw/keys/$S.keyinfo \
-hls_segment_filename "$O/%v/s%04d.ts" -master_pl_name master.m3u8 \
-var_stream_map "v:0,a:0,name:1080 v:1,a:1,name:720 v:2,a:2,name:480" "$O/%v/index.m3u8"
touch $O/done
