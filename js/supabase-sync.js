/**
 * Supabase 数据同步模块
 * 实现 iPad 和 Mac 设备之间的数据同步
 */

const SupabaseSync = {
    _client: null,
    _isInitialized: false,
    _lastSyncTime: null,
    _isSyncing: false,

    /**
     * 初始化 Supabase 客户端
     */
    init() {
        if (this._isInitialized) {
            return Promise.resolve();
        }

        // 检查配置（优先使用 localStorage 中的配置）
        const supabaseConfig = Config.getSupabase();
        if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
            console.error('[SupabaseSync] Supabase 配置未设置');
            return Promise.reject(new Error('Supabase 配置未设置，请在浏览器控制台执行：Config.saveSupabase({url: "你的URL", anonKey: "你的Key"})'));
        }

        // 检查 Supabase 客户端库是否加载
        if (typeof supabase === 'undefined') {
            console.error('[SupabaseSync] Supabase 客户端库未加载');
            return Promise.reject(new Error('Supabase 客户端库未加载'));
        }

        try {
            // 获取配置（优先使用 localStorage 中的配置）
            const supabaseConfig = Config.getSupabase();
            // 创建 Supabase 客户端（使用匿名认证，单用户模式）
            this._client = supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
                auth: {
                    persistSession: false, // 单用户模式，不需要持久化会话
                    autoRefreshToken: false
                }
            });

            this._isInitialized = true;
            console.log('[SupabaseSync] 初始化成功');
            return Promise.resolve();
        } catch (error) {
            console.error('[SupabaseSync] 初始化失败:', error);
            return Promise.reject(error);
        }
    },

    /**
     * 获取或创建用户记录（单用户模式，使用固定用户ID）
     */
    async _ensureUserRecord() {
        const USER_ID = 'single_user'; // 固定用户ID，单用户模式
        
        try {
            // 尝试获取用户记录
            const { data: existingUser, error: fetchError } = await this._client
                .from('user_data')
                .select('id, last_sync_time')
                .eq('id', USER_ID)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 表示未找到记录
                throw fetchError;
            }

            if (!existingUser) {
                // 创建新用户记录
                const { data: newUser, error: createError } = await this._client
                    .from('user_data')
                    .insert({
                        id: USER_ID,
                        sync_data: {},
                        last_sync_time: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (createError) {
                    throw createError;
                }

                console.log('[SupabaseSync] 创建新用户记录');
                return newUser;
            }

            return existingUser;
        } catch (error) {
            console.error('[SupabaseSync] 确保用户记录失败:', error);
            throw error;
        }
    },

    /**
     * 上传数据到云端
     */
    async upload() {
        if (this._isSyncing) {
            console.warn('[SupabaseSync] 同步正在进行中，跳过本次上传');
            return { success: false, message: '同步正在进行中' };
        }

        this._isSyncing = true;

        try {
            await this.init();

            // 获取本地同步数据
            const syncData = Storage.exportSyncData();
            console.log('[SupabaseSync] 准备上传数据:', {
                wordMastery: Object.keys(syncData.wordMastery || {}).length,
                errorWords: syncData.errorWords?.length || 0,
                reviewPlans: syncData.reviewPlans?.length || 0,
                taskList: syncData.taskList?.length || 0
            });

            // 确保用户记录存在
            await this._ensureUserRecord();

            // 更新云端数据
            const { data, error } = await this._client
                .from('user_data')
                .update({
                    sync_data: syncData,
                    last_sync_time: new Date().toISOString()
                })
                .eq('id', 'single_user')
                .select()
                .single();

            if (error) {
                throw error;
            }

            this._lastSyncTime = new Date().toISOString();
            console.log('[SupabaseSync] 上传成功');
            
            return {
                success: true,
                message: '上传成功',
                lastSyncTime: this._lastSyncTime
            };
        } catch (error) {
            console.error('[SupabaseSync] 上传失败:', error);
            return {
                success: false,
                message: error.message || '上传失败'
            };
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * 从云端下载数据
     */
    async download() {
        if (this._isSyncing) {
            console.warn('[SupabaseSync] 同步正在进行中，跳过本次下载');
            return { success: false, message: '同步正在进行中' };
        }

        this._isSyncing = true;

        try {
            await this.init();

            // 获取云端数据
            const { data, error } = await this._client
                .from('user_data')
                .select('sync_data, last_sync_time')
                .eq('id', 'single_user')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // 未找到记录，返回空数据
                    console.log('[SupabaseSync] 云端暂无数据');
                    return {
                        success: true,
                        message: '云端暂无数据',
                        data: null
                    };
                }
                throw error;
            }

            if (!data || !data.sync_data) {
                console.log('[SupabaseSync] 云端数据为空');
                return {
                    success: true,
                    message: '云端数据为空',
                    data: null
                };
            }

            this._lastSyncTime = data.last_sync_time;
            console.log('[SupabaseSync] 下载成功:', {
                wordMastery: Object.keys(data.sync_data.wordMastery || {}).length,
                errorWords: data.sync_data.errorWords?.length || 0,
                reviewPlans: data.sync_data.reviewPlans?.length || 0,
                taskList: data.sync_data.taskList?.length || 0
            });

            return {
                success: true,
                message: '下载成功',
                data: data.sync_data,
                lastSyncTime: data.last_sync_time
            };
        } catch (error) {
            console.error('[SupabaseSync] 下载失败:', error);
            return {
                success: false,
                message: error.message || '下载失败'
            };
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * 同步数据（智能合并：下载云端数据，与本地数据合并，然后上传）
     */
    async sync() {
        if (this._isSyncing) {
            console.warn('[SupabaseSync] 同步正在进行中');
            return { success: false, message: '同步正在进行中' };
        }

        this._isSyncing = true;

        try {
            // 1. 先上传本地数据（确保云端有最新数据）
            console.log('[SupabaseSync] 步骤1: 上传本地数据...');
            const uploadResult = await this.upload();
            if (!uploadResult.success) {
                console.warn('[SupabaseSync] 上传失败，继续尝试下载...');
            }

            // 2. 下载云端数据
            console.log('[SupabaseSync] 步骤2: 下载云端数据...');
            const downloadResult = await this.download();
            if (!downloadResult.success) {
                throw new Error(downloadResult.message);
            }

            // 3. 如果云端有数据，合并到本地
            if (downloadResult.data) {
                console.log('[SupabaseSync] 步骤3: 合并数据到本地...');
                try {
                    // 使用合并模式导入云端数据
                    Storage.importSyncData(downloadResult.data, true);
                    console.log('[SupabaseSync] 数据合并成功');
                } catch (mergeError) {
                    console.error('[SupabaseSync] 数据合并失败:', mergeError);
                    throw mergeError;
                }
            }

            // 4. 再次上传合并后的数据（确保两端一致）
            console.log('[SupabaseSync] 步骤4: 上传合并后的数据...');
            const finalUploadResult = await this.upload();
            if (!finalUploadResult.success) {
                console.warn('[SupabaseSync] 最终上传失败，但本地数据已更新');
            }

            this._lastSyncTime = new Date().toISOString();
            console.log('[SupabaseSync] 同步完成');

            return {
                success: true,
                message: '同步成功',
                lastSyncTime: this._lastSyncTime
            };
        } catch (error) {
            console.error('[SupabaseSync] 同步失败:', error);
            return {
                success: false,
                message: error.message || '同步失败'
            };
        } finally {
            this._isSyncing = false;
        }
    },

    /**
     * 获取最后同步时间
     */
    getLastSyncTime() {
        return this._lastSyncTime;
    },

    /**
     * 检查是否正在同步
     */
    isSyncing() {
        return this._isSyncing;
    }
};

