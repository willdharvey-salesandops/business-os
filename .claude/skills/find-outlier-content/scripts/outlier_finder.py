#!/usr/bin/env python3
"""
YouTube Outlier Content Finder

Discovers creators in a niche, pulls their recent videos, and identifies
statistical outliers (videos that significantly over-performed relative
to the channel's median views).

Usage:
    python outlier_finder.py discover --keywords "small business founder,scaling" [--max-channels 20]
    python outlier_finder.py channel --channel-id UCxxx [--months 12]
    python outlier_finder.py watchlist --watchlist path/to/watchlist.json [--months 6]

Requires: YOUTUBE_API_KEY environment variable
"""

import argparse
import json
import os
import sys
import statistics
from datetime import datetime, timedelta, timezone

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def get_youtube_client():
    """Build and return a YouTube API client."""
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        print("Error: YOUTUBE_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)
    return build("youtube", "v3", developerKey=api_key)


def discover_channels(youtube, keywords, max_channels=20, min_subscribers=1000, max_subscribers=100000):
    """Discover channels by searching for popular videos, then extracting their channels.

    This is more effective than YouTube's channel search, which returns
    mostly tiny/irrelevant channels. By finding videos with high view counts
    first, we naturally surface established creators.

    Filters to channels between min_subscribers and max_subscribers to focus
    on smaller creators where outliers are a stronger topic/hook signal.
    """
    channels = {}  # channel_id -> channel data

    for keyword in keywords:
        try:
            # Search by relevance (not viewCount) to avoid only surfacing mega-channels
            request = youtube.search().list(
                part="snippet",
                q=keyword,
                type="video",
                maxResults=50,
                order="relevance",
                publishedAfter=(datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
            )
            response = request.execute()

            for item in response.get("items", []):
                channel_id = item["snippet"]["channelId"]
                if channel_id not in channels:
                    channels[channel_id] = {
                        "channel_id": channel_id,
                        "name": item["snippet"]["channelTitle"],
                        "discovered_via": keyword,
                        "sample_video": item["snippet"]["title"]
                    }
        except HttpError as e:
            print(f"Error searching for '{keyword}': {e}", file=sys.stderr)

    # Enrich all found channels with stats
    channel_list = list(channels.values())
    if channel_list:
        channel_list = enrich_channels(youtube, channel_list)

    # Filter by subscriber range
    channel_list = [
        c for c in channel_list
        if min_subscribers <= c.get("subscriber_count", 0) <= max_subscribers
    ]
    channel_list.sort(key=lambda c: c.get("subscriber_count", 0), reverse=True)

    return channel_list[:max_channels]


def enrich_channels(youtube, channels):
    """Add subscriber count and uploads playlist ID to channel data."""
    channel_ids = [c["channel_id"] for c in channels]

    # API allows up to 50 IDs per request
    for i in range(0, len(channel_ids), 50):
        batch = channel_ids[i:i + 50]
        try:
            request = youtube.channels().list(
                part="statistics,contentDetails",
                id=",".join(batch)
            )
            response = request.execute()

            id_to_data = {}
            for item in response.get("items", []):
                id_to_data[item["id"]] = {
                    "subscriber_count": int(item["statistics"].get("subscriberCount", 0)),
                    "video_count": int(item["statistics"].get("videoCount", 0)),
                    "uploads_playlist": item["contentDetails"]["relatedPlaylists"]["uploads"]
                }

            for channel in channels:
                data = id_to_data.get(channel["channel_id"], {})
                channel.update(data)

        except HttpError as e:
            print(f"Error enriching channels: {e}", file=sys.stderr)

    return channels


def get_recent_videos(youtube, uploads_playlist, months=6):
    """Get recent videos from a channel's uploads playlist."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    videos = []
    next_page = None

    while True:
        try:
            request = youtube.playlistItems().list(
                part="snippet",
                playlistId=uploads_playlist,
                maxResults=50,
                pageToken=next_page
            )
            response = request.execute()

            for item in response.get("items", []):
                published = item["snippet"].get("publishedAt", "")
                if published:
                    pub_date = datetime.fromisoformat(published.replace("Z", "+00:00"))
                    if pub_date < cutoff:
                        return videos  # Older than our window, stop
                videos.append({
                    "video_id": item["snippet"]["resourceId"]["videoId"],
                    "title": item["snippet"]["title"],
                    "published_at": published,
                    "description": item["snippet"]["description"][:200]
                })

            next_page = response.get("nextPageToken")
            if not next_page:
                break

        except HttpError as e:
            print(f"Error fetching playlist items: {e}", file=sys.stderr)
            break

    return videos


def get_video_stats(youtube, video_ids):
    """Get view counts and other stats for a batch of videos."""
    stats = {}

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        try:
            request = youtube.videos().list(
                part="statistics,contentDetails",
                id=",".join(batch)
            )
            response = request.execute()

            for item in response.get("items", []):
                vid_stats = item["statistics"]
                stats[item["id"]] = {
                    "view_count": int(vid_stats.get("viewCount", 0)),
                    "like_count": int(vid_stats.get("likeCount", 0)),
                    "comment_count": int(vid_stats.get("commentCount", 0)),
                    "duration": item["contentDetails"].get("duration", "")
                }

        except HttpError as e:
            print(f"Error fetching video stats: {e}", file=sys.stderr)

    return stats


def find_outliers(videos, multiplier=3.0):
    """Identify videos that over-performed relative to the channel median.

    Returns videos sorted by outlier_score descending.
    An outlier_score of 3.0 means the video got 3x the median views.
    """
    if len(videos) < 3:
        return [], {}

    view_counts = [v["view_count"] for v in videos if v.get("view_count", 0) > 0]
    if not view_counts:
        return [], {}

    median_views = statistics.median(view_counts)
    mean_views = statistics.mean(view_counts)

    if median_views == 0:
        return [], {"median_views": 0, "mean_views": mean_views}

    channel_stats = {
        "median_views": int(median_views),
        "mean_views": int(mean_views),
        "total_videos_analyzed": len(videos),
    }

    outliers = []
    for video in videos:
        views = video.get("view_count", 0)
        if views > 0 and median_views > 0:
            score = views / median_views
            video["outlier_score"] = round(score, 2)
            if score >= multiplier:
                outliers.append(video)

    outliers.sort(key=lambda v: v["outlier_score"], reverse=True)
    return outliers, channel_stats


def analyze_channel(youtube, channel_id, months=6, top_n=10):
    """Full analysis pipeline for a single channel."""
    # Get channel info (also fetch snippet for channel name)
    try:
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails",
            id=channel_id
        )
        response = request.execute()
        items = response.get("items", [])
        if not items:
            print(f"Could not find channel {channel_id}", file=sys.stderr)
            return None

        item = items[0]
        channel = {
            "channel_id": channel_id,
            "name": item["snippet"]["title"],
            "subscriber_count": int(item["statistics"].get("subscriberCount", 0)),
            "video_count": int(item["statistics"].get("videoCount", 0)),
            "uploads_playlist": item["contentDetails"]["relatedPlaylists"]["uploads"]
        }
    except HttpError as e:
        print(f"Error fetching channel {channel_id}: {e}", file=sys.stderr)
        return None

    # Get recent videos
    videos = get_recent_videos(youtube, channel["uploads_playlist"], months)
    if not videos:
        return {
            "channel": channel,
            "outliers": [],
            "channel_stats": {},
            "message": "No recent videos found"
        }

    # Get stats for all videos
    video_ids = [v["video_id"] for v in videos]
    stats = get_video_stats(youtube, video_ids)

    # Merge stats into videos
    for video in videos:
        video.update(stats.get(video["video_id"], {}))

    # Find outliers, cap to top N
    outliers, channel_stats = find_outliers(videos)
    outliers = outliers[:top_n]

    return {
        "channel": channel,
        "outliers": outliers,
        "channel_stats": channel_stats,
        "all_videos_count": len(videos)
    }


def cmd_discover(args):
    """Handle the 'discover' command."""
    youtube = get_youtube_client()
    keywords = [k.strip() for k in args.keywords.split(",")]

    print(f"Searching for channels matching: {keywords}", file=sys.stderr)
    channels = discover_channels(youtube, keywords, args.max_channels, args.min_subscribers, args.max_subscribers)

    output = {
        "command": "discover",
        "keywords": keywords,
        "channels_found": len(channels),
        "channels": channels
    }
    print(json.dumps(output, indent=2))


def cmd_channel(args):
    """Handle the 'channel' command."""
    youtube = get_youtube_client()

    print(f"Analyzing channel {args.channel_id} (last {args.months} months)...", file=sys.stderr)
    result = analyze_channel(youtube, args.channel_id, args.months, args.top)

    if not result:
        print(json.dumps({"error": f"Channel {args.channel_id} not found"}))
        sys.exit(1)

    output = {
        "command": "channel",
        "channel": result["channel"],
        "channel_stats": result["channel_stats"],
        "all_videos_count": result.get("all_videos_count", 0),
        "outliers_found": len(result["outliers"]),
        "outliers": result["outliers"]
    }
    print(json.dumps(output, indent=2))


def cmd_watchlist(args):
    """Handle the 'watchlist' command."""
    youtube = get_youtube_client()

    # Load watchlist
    try:
        with open(args.watchlist, "r") as f:
            watchlist = json.load(f)
    except FileNotFoundError:
        print(f"Watchlist not found: {args.watchlist}", file=sys.stderr)
        sys.exit(1)

    channels = watchlist.get("channels", [])
    if not channels:
        print("Watchlist is empty.", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning {len(channels)} channels from watchlist...", file=sys.stderr)
    all_outliers = []

    for entry in channels:
        channel_id = entry.get("channel_id")
        name = entry.get("name", channel_id)
        print(f"  Scanning: {name}...", file=sys.stderr)

        result = analyze_channel(youtube, channel_id, args.months, args.top)
        if result and result["outliers"]:
            for outlier in result["outliers"]:
                outlier["channel_name"] = name
                outlier["channel_id"] = channel_id
            all_outliers.extend(result["outliers"])

    # Sort all outliers by score
    all_outliers.sort(key=lambda v: v["outlier_score"], reverse=True)

    output = {
        "command": "watchlist",
        "channels_scanned": len(channels),
        "total_outliers_found": len(all_outliers),
        "outliers": all_outliers
    }
    print(json.dumps(output, indent=2))


def main():
    parser = argparse.ArgumentParser(description="YouTube Outlier Content Finder")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # discover
    discover_parser = subparsers.add_parser("discover", help="Discover channels in a niche")
    discover_parser.add_argument("--keywords", required=True, help="Comma-separated search keywords")
    discover_parser.add_argument("--max-channels", type=int, default=20, help="Max channels to return")
    discover_parser.add_argument("--min-subscribers", type=int, default=1000, help="Minimum subscriber count")
    discover_parser.add_argument("--max-subscribers", type=int, default=100000, help="Maximum subscriber count (filters out big channels)")

    # channel
    channel_parser = subparsers.add_parser("channel", help="Find outliers for a specific channel")
    channel_parser.add_argument("--channel-id", required=True, help="YouTube channel ID (UCxxx)")
    channel_parser.add_argument("--months", type=int, default=12, help="How many months back to analyze")
    channel_parser.add_argument("--top", type=int, default=10, help="Return top N outliers only")

    # watchlist
    watchlist_parser = subparsers.add_parser("watchlist", help="Scan all channels in a watchlist")
    watchlist_parser.add_argument("--watchlist", required=True, help="Path to watchlist JSON file")
    watchlist_parser.add_argument("--months", type=int, default=6, help="How many months back to analyze")
    watchlist_parser.add_argument("--top", type=int, default=5, help="Top N outliers per channel")

    args = parser.parse_args()

    if args.command == "discover":
        cmd_discover(args)
    elif args.command == "channel":
        cmd_channel(args)
    elif args.command == "watchlist":
        cmd_watchlist(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
