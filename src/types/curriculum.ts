export interface Grade {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  gradeId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
