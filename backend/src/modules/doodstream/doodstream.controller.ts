import { Request, Response, NextFunction } from 'express';
import * as doodService from './doodstream.service';
import { AppError } from '../../types';

export const getAccountInfo = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await doodService.getAccountInfo();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getAccountStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const last = Number(req.query.last) || undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const data = await doodService.getAccountStats(last, from, to);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const remoteUploadAdd = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, fld_id, new_title } = req.query as Record<string, string>;
    if (!url) throw new AppError('Missing ?url= param', 400);
    const data = await doodService.remoteUploadAdd(url, fld_id, new_title);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const remoteUploadList = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await doodService.remoteUploadList();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const remoteUploadStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code } = req.query as Record<string, string>;
    if (!file_code) throw new AppError('Missing ?file_code= param', 400);
    const data = await doodService.remoteUploadStatus(file_code);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const remoteUploadSlots = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await doodService.remoteUploadSlots();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const remoteUploadActions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restart_errors, clear_errors, clear_all, delete_code } = req.query as Record<string, string>;
    const msg = await doodService.remoteUploadActions({
      restartErrors: !!restart_errors,
      clearErrors: !!clear_errors,
      clearAll: !!clear_all,
      deleteCode: delete_code,
    });
    res.json({ success: true, data: { msg }, message: null });
  } catch (error) {
    next(error);
  }
};

export const createFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, parent_id } = req.query as Record<string, string>;
    if (!name) throw new AppError('Missing ?name= param', 400);
    const data = await doodService.createFolder(name, parent_id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const renameFolder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fld_id, name } = req.query as Record<string, string>;
    if (!fld_id || !name) throw new AppError('Missing ?fld_id= or ?name=', 400);
    const data = await doodService.renameFolder(fld_id, name);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const listFolders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fld_id, only_folders } = req.query as Record<string, string>;
    const data = await doodService.listFolders(fld_id || '0', only_folders === '1');
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const listFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, per_page, fld_id, created } = req.query as Record<string, string>;
    const data = await doodService.listFiles({
      page: Number(page) || undefined,
      perPage: Number(per_page) || undefined,
      fldId: fld_id,
      created,
    });
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getFileInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code } = req.query as Record<string, string>;
    if (!file_code) throw new AppError('Missing ?file_code= param', 400);
    const data = await doodService.getFileInfo(file_code);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const checkFileStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code } = req.query as Record<string, string>;
    if (!file_code) throw new AppError('Missing ?file_code= param', 400);
    const data = await doodService.checkFileStatus(file_code);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getFileImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code } = req.query as Record<string, string>;
    if (!file_code) throw new AppError('Missing ?file_code= param', 400);
    const data = await doodService.getFileImage(file_code);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const renameFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code, title } = req.query as Record<string, string>;
    if (!file_code || !title) throw new AppError('Missing ?file_code= or ?title=', 400);
    const data = await doodService.renameFile(file_code, title);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const moveFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code, fld_id } = req.query as Record<string, string>;
    if (!file_code || !fld_id) throw new AppError('Missing ?file_code= or ?fld_id=', 400);
    const data = await doodService.moveFile(file_code, fld_id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const searchFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search_term } = req.query as Record<string, string>;
    if (!search_term) throw new AppError('Missing ?search_term= param', 400);
    const data = await doodService.searchFiles(search_term);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const cloneFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { file_code, fld_id } = req.query as Record<string, string>;
    if (!file_code) throw new AppError('Missing ?file_code= param', 400);
    const data = await doodService.cloneFile(file_code, fld_id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};
