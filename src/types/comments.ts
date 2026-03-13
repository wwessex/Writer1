// Comment types
export interface CommentAnchorRange {
  from: number;
  to: number;
  length: number;
  selectedText?: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  chapterId: string;
  anchor: CommentAnchorRange;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
  comments: Comment[];
}
